'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import type { Trip, Route, Fare } from '@/lib/database.types';
import { AGENCY_VEHICLE_MAP } from '@/lib/database.types';

interface RoutesPanelProps {
  routes: Route[];
  trips: Trip[];
  fares: Fare[];
  selectedTripId: string | null;
  onSelectTrip: (trip: Trip) => void;
}

export function RoutesPanel({ routes, trips, fares, selectedTripId, onSelectTrip }: RoutesPanelProps) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build route lookup
  const routeMap = useMemo(() => {
    const m: Record<string, Route> = {};
    for (const r of routes) m[r.route_id] = r;
    return m;
  }, [routes]);

  // Group trips by route for display, but keep flat for selection
  const filtered = useMemo(() => {
    if (!search.trim()) return trips;
    const q = search.toLowerCase();
    return trips.filter((t) => {
      const route = routeMap[t.route_id];
      const searchFields = [
        route?.route_long_name,
        route?.route_long_name_ar,
        route?.route_short_name,
        route?.route_short_name_ar,
        t.trip_headsign,
        t.trip_headsign_ar,
        t.main_streets,
        t.main_streets_ar,
      ].filter(Boolean).join(' ').toLowerCase();
      return searchFields.includes(q);
    });
  }, [trips, routes, search, routeMap]);

  useEffect(() => {
    if (search.trim()) setOpen(true);
  }, [search]);

  const handleSelect = (trip: Trip) => {
    onSelectTrip(trip);
    setOpen(false);
    setSearch('');
    inputRef.current?.blur();
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 25,
        width: 'min(460px, calc(100vw - 32px))',
      }}
    >
      {/* Search bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'hsl(var(--background) / 0.97)',
          border: '1px solid hsl(var(--border) / 0.6)',
          borderRadius: open ? '12px 12px 0 0' : 12,
          padding: '8px 14px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
          backdropFilter: 'blur(12px)',
          transition: 'border-radius 0.15s',
        }}
      >
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0, opacity: 0.45 }}>
          <path d="M10 6.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Zm-.691 3.516 2.838 2.837a.5.5 0 0 1-.707.707L8.602 9.723A4.5 4.5 0 1 1 9.309 9.016Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"/>
        </svg>
        <input
          ref={inputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={`Search ${routes.length} routes / ${trips.length} trips…`}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: 14,
            color: 'hsl(var(--foreground))',
            fontFamily: 'inherit',
          }}
        />
        {search && (
          <button
            onClick={() => { setSearch(''); inputRef.current?.focus(); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 2, opacity: 0.5, color: 'hsl(var(--foreground))',
              fontSize: 16, lineHeight: 1,
            }}
          >x</button>
        )}
        {!search && (
          <button
            onClick={() => setOpen((v) => !v)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '2px 6px', opacity: 0.5, color: 'hsl(var(--foreground))',
              fontSize: 11, lineHeight: 1, letterSpacing: '0.05em',
              fontWeight: 600,
            }}
          >
            {open ? 'Hide' : 'Show'}
          </button>
        )}
      </div>

      {/* Dropdown list */}
      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: -1 }}
            onClick={() => { setOpen(false); setSearch(''); }}
          />
          <div
            style={{
              background: 'hsl(var(--background) / 0.97)',
              border: '1px solid hsl(var(--border) / 0.6)',
              borderTop: 'none',
              borderRadius: '0 0 12px 12px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              backdropFilter: 'blur(12px)',
              maxHeight: 400,
              overflowY: 'auto',
            }}
          >
            {filtered.length === 0 ? (
              <div style={{ padding: '20px 16px', textAlign: 'center', opacity: 0.5, fontSize: 13 }}>
                No routes match &quot;{search}&quot;
              </div>
            ) : (
              filtered.map((trip) => {
                const route = routeMap[trip.route_id];
                const fare = route ? fares.find((f) => f.route_id === route.route_id) : null;
                const isSelected = trip.trip_id === selectedTripId;
                const vehicle = route ? AGENCY_VEHICLE_MAP[route.agency_id || ''] : null;

                return (
                  <button
                    key={trip.trip_id}
                    onClick={() => handleSelect(trip)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 14px',
                      background: isSelected ? 'hsl(var(--primary) / 0.08)' : 'transparent',
                      border: 'none',
                      borderBottom: '1px solid hsl(var(--border) / 0.3)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'hsl(var(--accent) / 0.5)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                  >
                    {/* Vehicle badge */}
                    <div style={{
                      width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                      background: isSelected ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700, color: isSelected ? 'white' : 'hsl(var(--muted-foreground))',
                      transition: 'background 0.1s',
                    }}>
                      {route?.agency_id === 'Bus' ? 'B' : route?.agency_id === 'Minibus' ? 'Mn' : 'Mb'}
                    </div>

                    {/* Name + meta */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 600,
                        color: isSelected ? 'hsl(var(--primary))' : 'hsl(var(--foreground))',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {route?.route_long_name || trip.trip_headsign || trip.trip_id}
                      </div>
                      {route?.route_long_name_ar && (
                        <div style={{ fontSize: 12, opacity: 0.7, direction: 'rtl', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {route.route_long_name_ar}
                        </div>
                      )}
                      <div style={{ fontSize: 11, opacity: 0.5, marginTop: 1, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {vehicle && <span>{vehicle.en}</span>}
                        {trip.trip_headsign && <span>→ {trip.trip_headsign}</span>}
                        {trip.direction_id === 1 && <span>inbound</span>}
                        {fare?.amount != null && <span>{fare.amount} EGP</span>}
                      </div>
                    </div>

                    {isSelected && (
                      <div style={{ fontSize: 11, opacity: 0.6, flexShrink: 0, color: 'hsl(var(--primary))' }}>
                        on map
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}