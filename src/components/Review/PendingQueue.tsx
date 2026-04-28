'use client';

import { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { createClient } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import type { Trip, Route } from '@/lib/database.types';

export interface PendingQueueRef {
  reload: () => void;
}

interface PendingQueueProps {
  onSelectTrip: (trip: Trip) => void;
  selectedTripId: string | null;
}

const supabase = createClient();

export const PendingQueue = forwardRef<PendingQueueRef, PendingQueueProps>(
  function PendingQueue({ onSelectTrip, selectedTripId }, ref) {
    const [trips, setTrips] = useState<Trip[]>([]);
    const [routes, setRoutes] = useState<Record<string, Route>>({});
    const [loading, setLoading] = useState(true);

    const loadTrips = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('trips')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (data) {
        setTrips(data);
        // Load routes for these trips
        const routeIds = [...new Set(data.map((t: Trip) => t.route_id))];
        if (routeIds.length > 0) {
          const { data: routesData } = await supabase
            .from('routes')
            .select('*')
            .in('route_id', routeIds);
          if (routesData) {
            const map: Record<string, Route> = {};
            (routesData as Route[]).forEach(r => { map[r.route_id] = r; });
            setRoutes(map);
          }
        }
      }
      setLoading(false);
    };

    useImperativeHandle(ref, () => ({ reload: loadTrips }));

    useEffect(() => {
      loadTrips();
      const channel = supabase
        .channel('pending-trips')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => {
          loadTrips();
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }

    if (trips.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <div className="text-4xl mb-3">--</div>
          <p className="font-medium">All caught up!</p>
          <p className="text-sm mt-1">No pending contributions to review.</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground px-1">
          Pending ({trips.length})
        </h3>
        {trips.map((trip) => {
          const route = routes[trip.route_id];
          const displayName = trip.parent_trip_id
            ? (trip.trip_headsign || route?.route_long_name || trip.trip_id)
            : (route?.route_long_name || trip.trip_headsign || trip.trip_id);

          return (
            <button
              key={trip.trip_id}
              onClick={() => onSelectTrip(trip)}
              className={`w-full text-left p-3 rounded-lg border transition-all ${
                selectedTripId === trip.trip_id
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border/50 hover:border-border hover:bg-accent/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm truncate flex-1 mr-2">{displayName}</span>
                <Badge variant="secondary" className="text-[10px] flex-shrink-0">pending</Badge>
              </div>
              {route?.route_long_name_ar && (
                <p className="text-xs text-muted-foreground mt-0.5" dir="rtl">{route.route_long_name_ar}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1" suppressHydrationWarning>
                {new Date(trip.created_at).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </button>
          );
        })}
      </div>
    );
  }
);
