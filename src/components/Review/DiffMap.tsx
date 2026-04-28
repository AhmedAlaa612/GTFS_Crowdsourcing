'use client';

import { useState, useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import type L from 'leaflet';
import { Polyline, Marker, Tooltip } from 'react-leaflet';
import { MapView } from '@/components/Map/MapView';
import { createClient } from '@/lib/supabase';
import type { Trip, TripShape, Stop } from '@/lib/database.types';

export interface DiffMapRef {
  reload: () => void;
}

interface DiffMapProps {
  trip: Trip | null;
}

const supabase = createClient();

export const DiffMap = forwardRef<DiffMapRef, DiffMapProps>(
  function DiffMap({ trip }, ref) {
    const [map, setMap] = useState<L.Map | null>(null);
    const [MarkerIcon, setMarkerIcon] = useState<any>(null);
    const [shape, setShape] = useState<TripShape | null>(null);
    const [stops, setStops] = useState<Stop[]>([]);

    // Keep trip in a ref so loadData always sees the latest value
    // without needing to be re-created (avoids stale closure in useImperativeHandle)
    const tripRef = useRef(trip);
    useEffect(() => { tripRef.current = trip; }, [trip]);

    const handleMapReady = useCallback((m: L.Map) => setMap(m), []);

    const loadData = useCallback(async () => {
      const currentTrip = tripRef.current;
      if (!currentTrip) {
        setShape(null);
        setStops([]);
        return;
      }

      const [shapeRes, tripStopsRes] = await Promise.all([
        supabase.from('trip_shapes').select('*').eq('trip_id', currentTrip.id).single(),
        supabase.from('stop_times').select('stop_id, stop_sequence').eq('trip_id', currentTrip.id).order('stop_sequence'),
      ]);

      setShape((shapeRes.data as TripShape) ?? null);

      const tripStopsData = tripStopsRes.data;
      if (tripStopsData?.length) {
        const stopIds = tripStopsData.map((ts) => ts.stop_id);
        const { data: stopsData } = await supabase.from('stops').select('*').in('stop_id', stopIds);
        if (stopsData) {
          const ordered = tripStopsData
            .map((ts) => stopsData.find((s: any) => s.stop_id === ts.stop_id))
            .filter(Boolean);
          // Map to legacy shape for rendering
          setStops(ordered.map((s: any) => ({ ...s, id: s.stop_id, name: s.stop_name, lat: s.stop_lat, lon: s.stop_lon })) as Stop[]);
        }
      } else {
        setStops([]);
      }
    }, []); // stable — reads trip via ref, never goes stale

    // Expose reload() — always points to the same stable loadData
    useImperativeHandle(ref, () => ({ reload: loadData }), [loadData]);

    // Re-fetch whenever the selected trip changes
    useEffect(() => { loadData(); }, [trip, loadData]);

    // Fit map bounds + build marker icon factory
    useEffect(() => {
      if (!map) return;
      import('leaflet').then((L) => {
        const bounds = L.default.latLngBounds([]);
        if (shape?.geojson?.coordinates?.length) {
          shape.geojson.coordinates.forEach((pt: any) => bounds.extend([pt[1], pt[0]]));
        } else {
          stops.forEach((s) => bounds.extend([s.lat, s.lon]));
        }
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });

        setMarkerIcon(() => (idx: number) =>
          L.default.divIcon({
            className: 'custom-div-icon',
            html: `<div style="
              width:24px;height:24px;
              background:#eab308;
              border:2px solid white;
              border-radius:50%;
              display:flex;align-items:center;justify-content:center;
              font-size:11px;font-weight:700;color:white;
              box-shadow:0 2px 4px rgba(0,0,0,0.3);
            ">${idx + 1}</div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          })
        );
      });
    }, [map, shape, stops]);

    if (!trip) {
      return (
        <div className="h-full flex items-center justify-center text-muted-foreground border border-border rounded-lg bg-muted/5">
          Select a trip to view its map
        </div>
      );
    }

    const polylinePositions: [number, number][] = shape?.geojson?.coordinates?.length
      ? shape.geojson.coordinates.map((pt: any) => [pt[1], pt[0]])
      : stops.map((s) => [s.lat, s.lon]);

    return (
      <MapView onMapReady={handleMapReady}>
        {polylinePositions.length > 1 && (
          <Polyline
            positions={polylinePositions}
            pathOptions={{ color: '#eab308', weight: 4, opacity: 0.8, dashArray: '8, 8' }}
          />
        )}
        {MarkerIcon && stops.map((stop, idx) => (
          <Marker key={stop.id + '-' + idx} position={[stop.lat, stop.lon]} icon={MarkerIcon(idx)}>
            <Tooltip>{stop.name || `Stop ${idx + 1}`}</Tooltip>
          </Marker>
        ))}
      </MapView>
    );
  }
);