'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import type { Stop } from '@/lib/database.types';
import type { NearbyTrip } from '@/lib/nearby-trips';

interface GapChecklistProps {
  stop: Stop;
}

interface ChecklistItem {
  name: string;
  inDb: boolean;
  tripId?: string;
}

export function GapChecklist({ stop }: GapChecklistProps) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const loadGaps = async () => {
      setLoading(true);

      try {
        // 1. Get trips from external API that start from this stop
        let apiTrips: NearbyTrip[] = [];
        try {
          const res = await fetch(
            `/api/nearby?lat=${stop.stop_lat}&lon=${stop.stop_lon}&radius_m=200&starts=true`
          );
          if (res.ok) {
            const data = await res.json();
            apiTrips = data.trips || [];
          }
        } catch {
          // API not available
        }

        // 2. Get trips from DB that have this stop as first stop
        const { data: stopTimes } = await supabase
          .from('stop_times')
          .select('trip_id, stop_id, stop_sequence')
          .eq('stop_id', stop.stop_id)
          .eq('stop_sequence', 1);

        const dbTripIds = new Set(
          (stopTimes as any[] || []).map((st) => st.trip_id)
        );

        // 3. Build checklist
        const checklist: ChecklistItem[] = [];

        // Add DB trips as existing
        if (stopTimes && stopTimes.length > 0) {
          const { data: trips } = await supabase
            .from('trips')
            .select('trip_id, trip_headsign, route_id')
            .in(
              'trip_id',
              (stopTimes as any[]).map((st) => st.trip_id)
            );

          if (trips) {
            // Load route names for these trips
            const routeIds = [...new Set(trips.map((t: any) => t.route_id))];
            const { data: routes } = await supabase
              .from('routes')
              .select('route_id, route_long_name')
              .in('route_id', routeIds);

            const routeMap: Record<string, string> = {};
            (routes || []).forEach((r: any) => { routeMap[r.route_id] = r.route_long_name; });

            (trips as any[]).forEach((t) => {
              checklist.push({
                name: routeMap[t.route_id] || t.trip_headsign || t.trip_id,
                inDb: true,
                tripId: t.trip_id,
              });
            });
          }
        }

        // Add API trips that aren't in DB
        apiTrips.forEach((at) => {
          const name = at.route_name || at.trip_headsign || '';
          const alreadyAdded = checklist.some(
            (c) => c.name.toLowerCase() === name.toLowerCase()
          );
          if (!alreadyAdded && name) {
            checklist.push({ name, inDb: false });
          }
        });

        setItems(checklist);
      } catch (err) {
        console.error('Gap checklist error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadGaps();
  }, [stop, supabase, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No trip data available for this stop. Configure the nearby trips API to
        see gap analysis.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-muted-foreground">
        مواقف Gap Check — {stop.stop_name || 'Stop'}
      </h4>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div
            key={idx}
            className={`flex items-center justify-between p-2 rounded-lg border text-sm ${
              item.inDb
                ? 'border-green-500/30 bg-green-500/5'
                : 'border-red-500/30 bg-red-500/5'
            }`}
          >
            <div className="flex items-center gap-2">
              <span>{item.inDb ? '[Yes]' : '[No]'}</span>
              <span className={item.inDb ? '' : 'text-red-500 font-medium'}>
                {item.name}
              </span>
            </div>
            {!item.inDb && (
              <Button
                size="sm"
                variant="ghost"
                className="text-xs h-7"
                onClick={() =>
                  router.push(
                    `/contribute?prefill=${encodeURIComponent(item.name)}`
                  )
                }
              >
                Add
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
