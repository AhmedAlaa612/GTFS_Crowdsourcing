"use client";

import { Polyline, Tooltip } from "react-leaflet";
import type { Trip, TripShape } from "@/lib/database.types";

// Trip rows may include optional GTFS route fields joined from the routes table
interface TripWithRouteFields extends Trip {
  route_color?: string | null;
  route_short_name?: string | null;
  route_long_name?: string | null;
}

interface RouteLayerProps {
  trips: Trip[];
  shapes: TripShape[];
  onTripClick?: (trip: Trip) => void;
  interactive?: boolean;
}

export function RouteLayer({
  trips,
  shapes,
  onTripClick,
  interactive = true,
}: RouteLayerProps) {
  return (
    <>
      {trips.map((trip) => {
        const t = trip as TripWithRouteFields;
        const tripShape = shapes.find((s) => s.trip_id === trip.id);

        if (
          !tripShape ||
          !tripShape.geojson ||
          !tripShape.geojson.coordinates ||
          tripShape.geojson.coordinates.length < 2
        )
          return null;

        const positions = tripShape.geojson.coordinates.map(
          (pt: number[]) => [pt[1], pt[0]] as [number, number]
        );

        const color = t.route_color ? `#${t.route_color}` : "#3b82f6";
        const displayName = t.route_short_name || trip.name;

        return (
          <Polyline
            key={trip.id}
            positions={positions}
            pathOptions={{ color, weight: 4, opacity: 0.8 }}
            eventHandlers={{
              click: () => interactive && onTripClick?.(trip),
              mouseover: (e) => {
                if (!interactive) return;
                e.target.setStyle({ weight: 6, opacity: 1 });
              },
              mouseout: (e) => {
                if (!interactive) return;
                e.target.setStyle({ weight: 4, opacity: 0.8 });
              },
            }}
          >
            {interactive && (
              <Tooltip sticky>
                <div className="font-semibold">{displayName}</div>
                {t.route_long_name && (
                  <div className="text-xs text-muted-foreground">
                    {t.route_long_name}
                  </div>
                )}
              </Tooltip>
            )}
          </Polyline>
        );
      })}
    </>
  );
}
