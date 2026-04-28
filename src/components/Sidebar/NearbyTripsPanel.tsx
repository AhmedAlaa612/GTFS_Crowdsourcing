'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

// Matches the actual API response shape
interface NearbyTrip {
  trip_id: string;
  route_id: string;
  trip_headsign: string;
  trip_headsign_ar: string;
  direction_id: number;
  route_short_name: string;
  route_short_name_ar: string;
  route_name: string;
  route_name_ar: string;
  distance_m: number;
  closest_stop_id: string;
  closest_stop_name: string;
  closest_stop_name_ar: string;
  closest_stop_lat: number;
  closest_stop_lon: number;
  closest_stop_sequence: number;
}

interface NearbyTripsResponse {
  query: { lat: number; lon: number; radius_m: number; starts: boolean; epsg: number };
  count: number;
  trips: NearbyTrip[];
}

interface NearbyTripsPanelProps {
  lat: number;
  lon: number;
  isLoggedIn: boolean;
}

export function NearbyTripsPanel({ lat, lon, isLoggedIn }: NearbyTripsPanelProps) {
  const [trips, setTrips] = useState<NearbyTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchNearby = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/nearby?lat=${lat}&lon=${lon}&radius_m=1000`
        );
        if (!res.ok) throw new Error('Failed to fetch');
        const data: NearbyTripsResponse = await res.json();
        setTrips(data.trips || []);
      } catch {
        setError('Could not load nearby trips');
        setTrips([]);
      } finally {
        setLoading(false);
      }
    };
    fetchNearby();
  }, [lat, lon]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Nearby Trips</h3>
        <p className="text-sm text-muted-foreground">
          Routes passing near this location
        </p>
      </div>

      {error && (
        <p className="text-sm text-muted-foreground bg-muted rounded-lg px-3 py-2">
          {error}. The nearby trips API may not be running.
        </p>
      )}

      {trips.length === 0 && !error && (
        <p className="text-sm text-muted-foreground">
          No trips found near this location.
        </p>
      )}

      <div className="space-y-2">
        {trips.map((trip) => (
          <div
            key={trip.trip_id}
            className="p-3 rounded-lg border border-border/50 bg-card hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {trip.route_short_name && (
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {trip.route_short_name}
                  </Badge>
                )}
                <span className="font-medium text-sm truncate">
                  {trip.trip_headsign || trip.route_name}
                </span>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {Math.round(trip.distance_m)} m
              </span>
            </div>

            {trip.trip_headsign_ar && (
              <p className="text-xs text-muted-foreground mt-0.5 text-right" dir="rtl">
                {trip.trip_headsign_ar}
              </p>
            )}

            <p className="text-xs text-muted-foreground mt-1">
              📍 {trip.closest_stop_name}
              {trip.closest_stop_name_ar && (
                <span className="mr-1 ml-1 opacity-60">· {trip.closest_stop_name_ar}</span>
              )}
            </p>
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-border/50">
        <p className="text-sm text-muted-foreground mb-2">
          Don&apos;t see your route?
        </p>
        <Button
          size="sm"
          className="w-full"
          onClick={() => {
            if (isLoggedIn) {
              router.push('/contribute');
            } else {
              router.push('/?toast=login_required');
            }
          }}
        >
          + Add it
        </Button>
      </div>
    </div>
  );
}
