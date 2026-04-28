'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { PendingQueue, type PendingQueueRef } from '@/components/Review/PendingQueue';
import { ReviewActions } from '@/components/Review/ReviewActions';
import { createClient } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { Trip, Route, Stop, Fare, StopTime } from '@/lib/database.types';
import { AGENCY_VEHICLE_MAP } from '@/lib/database.types';
import dynamic from 'next/dynamic';
import type { DiffMapRef } from '@/components/Review/DiffMap';

const DiffMap = dynamic(
  () => import('@/components/Review/DiffMap').then((mod) => mod.DiffMap),
  { ssr: false }
);

const supabase = createClient();

export default function ReviewPage() {
  const queueRef = useRef<PendingQueueRef>(null);
  const diffMapRef = useRef<DiffMapRef>(null);

  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [tripStops, setTripStops] = useState<Stop[]>([]);
  const [fare, setFare] = useState<Fare | null>(null);
  const [mapKey, setMapKey] = useState(0);

  useEffect(() => {
    if (!selectedTrip) {
      setTripStops([]);
      setFare(null);
      setSelectedRoute(null);
      return;
    }

    const load = async () => {
      // Load route
      const { data: routeData } = await supabase
        .from('routes')
        .select('*')
        .eq('route_id', selectedTrip.route_id)
        .single();
      setSelectedRoute(routeData);

      // Load stop_times -> stops
      const { data: st } = await supabase
        .from('stop_times')
        .select('*')
        .eq('trip_id', selectedTrip.trip_id)
        .order('stop_sequence');

      if (st) {
        const stopIds = (st as StopTime[]).map((t) => t.stop_id);
        const { data: stopsData } = await supabase.from('stops').select('*').in('stop_id', stopIds);
        if (stopsData) {
          const ordered = (st as StopTime[])
            .map((stopTime) => (stopsData as Stop[]).find((s) => s.stop_id === stopTime.stop_id))
            .filter((s): s is Stop => Boolean(s));
          setTripStops(ordered);
        }
      }

      // Load fare (try pending trip_id first, then route_id)
      const { data: pendingFare } = await supabase.from('fares').select('*').eq('route_id', selectedTrip.trip_id).single();
      if (pendingFare) {
        setFare(pendingFare);
      } else {
        const { data: fareData } = await supabase.from('fares').select('*').eq('route_id', selectedTrip.route_id).single();
        setFare(fareData);
      }
    };

    load();
  }, [selectedTrip]);

  const handleActionComplete = () => {
    setSelectedTrip(null);
    queueRef.current?.reload();
  };

  const handleStopsChange = (stops: Stop[]) => {
    setTripStops(stops);
    setMapKey((k) => k + 1);
  };

  const vehicle = selectedRoute ? AGENCY_VEHICLE_MAP[selectedRoute.agency_id || ''] : null;

  // Bridge selectedTrip to the format DiffMap/ReviewActions expect
  // These components use .id, .name etc from the old schema
  const tripForLegacy = selectedTrip ? {
    ...selectedTrip,
    id: selectedTrip.trip_id,
    name: selectedTrip.parent_trip_id 
      ? (selectedTrip.trip_headsign || selectedRoute?.route_long_name || selectedTrip.trip_id)
      : (selectedRoute?.route_long_name || selectedTrip.trip_headsign || selectedTrip.trip_id),
  } : null;

  // Bridge stops for legacy components
  const stopsForLegacy = tripStops.map(s => ({
    ...s,
    id: s.stop_id,
    name: s.stop_name,
    lat: s.stop_lat,
    lon: s.stop_lon,
  }));

  const fareForLegacy = fare ? {
    ...fare,
    id: fare.route_id,
    trip_id: selectedTrip?.trip_id || '',
  } : null;

  return (
    <div className="h-screen flex flex-col">
      <header className="h-14 border-b border-border/50 bg-background/95 backdrop-blur-xl flex items-center justify-between px-4 z-30 relative flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-bold text-lg hidden sm:inline">Alexandria Transit</span>
          </Link>
          <span className="text-muted-foreground text-sm">/</span>
          <span className="text-sm font-medium">Review</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open('/api/export/gtfs', '_blank')}>
            Export GTFS
          </Button>
          <Link href="/" className="text-sm px-3 py-1.5 rounded-md hover:bg-accent transition-colors">
            Map
          </Link>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-full sm:w-[320px] lg:w-[360px] border-r border-border/50 bg-background overflow-y-auto p-4 flex-shrink-0">
          <PendingQueue
            ref={queueRef}
            onSelectTrip={(t: any) => {
              // PendingQueue may pass old-style or new-style trip objects
              // We need to handle both
              setSelectedTrip(t);
            }}
            selectedTripId={selectedTrip?.trip_id || (selectedTrip as any)?.id || null}
          />
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 relative min-h-0">
            <DiffMap
              key={mapKey}
              ref={diffMapRef}
              trip={tripForLegacy as any}
            />
          </div>

          {selectedTrip && (
            <div className="border-t border-border/50 bg-background/95 backdrop-blur-sm p-4 max-h-[320px] overflow-y-auto">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">
                      {selectedTrip.parent_trip_id
                        ? (selectedTrip.trip_headsign || selectedRoute?.route_long_name || selectedTrip.trip_id)
                        : (selectedRoute?.route_long_name || selectedTrip.trip_headsign || selectedTrip.trip_id)}
                    </h3>
                    {selectedRoute?.route_long_name_ar && (
                      <p className="text-sm text-muted-foreground" dir="rtl">{selectedRoute.route_long_name_ar}</p>
                    )}
                    <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                      Submitted{' '}
                      {new Date(selectedTrip.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Badge variant="secondary">pending</Badge>
                    {vehicle && <Badge variant="outline">{vehicle.en}</Badge>}
                  </div>
                </div>

                <div className="flex gap-6 text-sm flex-wrap">
                  <div>
                    <span className="text-muted-foreground">Stops: </span>
                    <strong>{tripStops.length}</strong>
                  </div>
                  {selectedTrip.trip_headsign && (
                    <div>
                      <span className="text-muted-foreground">→ </span>
                      <strong>{selectedTrip.trip_headsign}</strong>
                      {selectedTrip.trip_headsign_ar && (
                        <span className="text-muted-foreground ml-1 text-xs">({selectedTrip.trip_headsign_ar})</span>
                      )}
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Fare: </span>
                    <strong>
                      {fare && fare.amount != null ? `${fare.amount} ${fare.currency || 'EGP'}` : 'Unknown'}
                    </strong>
                  </div>
                  {selectedTrip.main_streets && (
                    <div>
                      <span className="text-muted-foreground">Via: </span>
                      <strong>{selectedTrip.main_streets}</strong>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-1">
                  {tripStops.map((stop, idx) => (
                    <span key={stop.stop_id} className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded-full">
                      <span className="font-bold">{idx + 1}.</span>
                      {stop.stop_name || 'Unnamed'}
                    </span>
                  ))}
                </div>

                <Separator />

                <ReviewActions
                  trip={tripForLegacy as any}
                  tripStops={stopsForLegacy as any}
                  fare={fareForLegacy as any}
                  onActionComplete={handleActionComplete}
                  onStopsChange={handleStopsChange as any}
                  onFareChange={setFare as any}
                  onNameChange={(newName) => {
                    if (selectedRoute) {
                      setSelectedRoute({ ...selectedRoute, route_long_name: newName });
                    } else if (selectedTrip) {
                      setSelectedTrip({ ...selectedTrip, trip_headsign: newName });
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}