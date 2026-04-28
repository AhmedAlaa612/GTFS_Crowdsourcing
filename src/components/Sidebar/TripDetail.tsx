'use client';

import { useState } from 'react';
import type { Trip, Route, Stop, Fare, StopTime } from '@/lib/database.types';
import { AGENCY_VEHICLE_MAP } from '@/lib/database.types';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { createClient } from '@/lib/supabase';
import { toast } from 'sonner';
import { SplitEditor } from '../Review/ReviewActions';
import type { MappedStop } from '@/components/Map/StopPicker';

interface TripDetailProps {
  trip: Trip;
  route: Route | null;
  stops: Stop[];
  stopTimes: StopTime[];
  fare?: Fare | null;
  userRole?: string;
}

export function TripDetail({ trip, route, stops, stopTimes, fare, userRole }: TripDetailProps) {
  const [showAllStops, setShowAllStops] = useState(false);
  const [showQuickEdit, setShowQuickEdit] = useState(false);
  const vehicle = route ? AGENCY_VEHICLE_MAP[route.agency_id || ''] : null;

  const displayStops = showAllStops ? stops : stops.slice(0, 10);

  const handleSaveQuickEdit = async (editStops: MappedStop[], editName: string, editFare: string) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('You must be logged in to edit.');
      return;
    }

    try {
      const pendingRouteId = String(Date.now()) + '_r';
      const pendingTripId = String(Date.now()) + '_t';
      const shapeId = pendingTripId + '_Shape';

      // 1. Insert pending route
      const { error: rErr } = await supabase.from('routes').insert({
        route_id: pendingRouteId,
        agency_id: route?.agency_id || trip.service_id, // fallback if needed
        route_long_name: editName,
        route_type: route?.route_type || 3,
        status: 'pending',
        contributor_id: user.id
      } as any);
      if (rErr) throw rErr;

      // 2. Insert pending trip
      const { error: tErr } = await supabase.from('trips').insert({
        trip_id: pendingTripId,
        route_id: pendingRouteId, // link to pending route
        service_id: trip.service_id || 'Ground_Daily',
        trip_headsign: editName,
        direction_id: trip.direction_id,
        shape_id: shapeId,
        status: 'pending',
        contributor_id: user.id,
        parent_trip_id: trip.trip_id,
      } as any);
      if (tErr) throw tErr;

      const resolvedStops: MappedStop[] = [];
      for (const stop of editStops) {
        if (stop.id.startsWith('new-')) {
          const newStopId = String(Date.now()) + '_' + Math.random().toString(36).slice(2, 6);
          const { data: inserted, error: sErr } = await supabase.from('stops').insert({
            stop_id: newStopId,
            stop_name: stop.name,
            stop_lat: stop.lat,
            stop_lon: stop.lon,
            status: 'pending',
          } as any).select().single();
          if (sErr) throw sErr;
          resolvedStops.push((inserted as unknown) as MappedStop);
        } else {
          resolvedStops.push(stop);
        }
      }

      const stopTimesInserts = resolvedStops.map((stop, idx) => ({
        trip_id: pendingTripId,
        stop_id: stop.id,
        stop_sequence: idx + 1,
        timepoint: 0,
      }));
      const { error: stErr } = await supabase.from('stop_times').insert(stopTimesInserts as any);
      if (stErr) throw stErr;

      // 5. Insert pending fare
      if (editFare && !isNaN(parseFloat(editFare))) {
        const { error: fErr } = await supabase.from('fares').insert({
          route_id: pendingRouteId, // Use the pending route ID
          amount: parseFloat(editFare),
          currency: 'EGP'
        } as any);
        if (fErr) throw fErr;
      }

      const { data: shape } = await supabase.from('trip_shapes').select('*').eq('trip_id', trip.trip_id).single();
      if (shape) {
        await supabase.from('trip_shapes').insert({
          trip_id: pendingTripId,
          geojson: shape.geojson
        } as any);
      }

      toast.success('Edit submitted for review!');
      setShowQuickEdit(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to submit edit.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold">{route?.route_long_name || trip.trip_headsign || trip.trip_id}</h3>
        {route?.route_long_name_ar && (
          <p className="text-base font-medium text-muted-foreground mt-0.5" dir="rtl">
            {route.route_long_name_ar}
          </p>
        )}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <Badge variant={trip.status === 'approved' || trip.status === 'existing' ? 'default' : trip.status === 'pending' ? 'secondary' : 'destructive'}>
            {trip.status}
          </Badge>
          {vehicle && (
            <Badge variant="outline">{vehicle.en} — {vehicle.ar}</Badge>
          )}
          {trip.direction_id === 1 && (
            <Badge variant="outline">Inbound</Badge>
          )}
        </div>
      </div>

      <Separator />

      {/* Trip headsign */}
      {trip.trip_headsign && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Headsign</span>
          <span className="font-medium text-sm">
            {trip.trip_headsign}
            {trip.trip_headsign_ar && (
              <span className="text-muted-foreground ml-2" dir="rtl">{trip.trip_headsign_ar}</span>
            )}
          </span>
        </div>
      )}

      {/* Main streets */}
      {trip.main_streets && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Via</span>
          <span className="font-medium text-sm">
            {trip.main_streets}
            {trip.main_streets_ar && (
              <span className="text-muted-foreground ml-2" dir="rtl">{trip.main_streets_ar}</span>
            )}
          </span>
        </div>
      )}

      {/* Fare */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Fare</span>
        <span className="font-medium">{fare && fare.amount !== null ? `${fare.amount} ${fare.currency || 'EGP'}` : 'Unknown'}</span>
      </div>

      <Separator />

      {/* Stops */}
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-3">Stops ({stops.length})</h4>
        <div className="space-y-1.5">
          {displayStops.map((stop, idx) => {
            const st = stopTimes.find(s => s.stop_id === stop.stop_id);
            return (
              <div key={stop.stop_id + idx} className="flex items-center gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: stop.status === 'existing' ? '#9ca3af' : '#22c55e' }}>
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{stop.stop_name}</div>
                  {stop.stop_name_ar && (
                    <div className="text-xs text-muted-foreground truncate" dir="rtl">{stop.stop_name_ar}</div>
                  )}
                </div>
                {st?.arrival_time && (
                  <span className="text-xs text-muted-foreground font-mono flex-shrink-0">
                    {st.arrival_time.slice(0, 5)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {stops.length > 10 && !showAllStops && (
          <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => setShowAllStops(true)}>
            Show all {stops.length} stops
          </Button>
        )}
      </div>

      <div className="pt-2">
        <Button 
          variant="outline" 
          className="w-full" 
          onClick={() => setShowQuickEdit(true)}
        >
          Quick Edit
        </Button>
      </div>

      <SplitEditor
        open={showQuickEdit}
        onOpenChange={setShowQuickEdit}
        trip={{...trip, id: trip.trip_id, name: route?.route_long_name || trip.trip_headsign || trip.trip_id, parent_trip_id: trip.parent_trip_id} as any}
        initialStops={stops.map(s => ({
          ...s,
          id: s.stop_id,
          name: s.stop_name,
          lat: s.stop_lat,
          lon: s.stop_lon
        })) as any}
        fare={fare || null}
        onSave={handleSaveQuickEdit}
      />
    </div>
  );
}