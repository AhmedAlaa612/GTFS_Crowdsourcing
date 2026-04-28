"use client";

import { CircleMarker, Tooltip } from "react-leaflet";
import type { Stop } from "@/lib/database.types";

interface StopLayerProps {
  stops: Stop[];
  onStopClick?: (stop: Stop) => void;
  interactive?: boolean;
}

export function StopLayer({
  stops,
  onStopClick,
  interactive = true,
}: StopLayerProps) {
  return (
    <>
      {stops.map((stop) => {
        const isApproved =
          stop.status === "approved" || stop.status === "existing";
        const color = isApproved ? "#22c55e" : "#f59e0b";

        return (
          <CircleMarker
            key={stop.stop_id}
            center={[stop.stop_lat, stop.stop_lon]}
            radius={6}
            pathOptions={{
              color: color,
              fillColor: color,
              fillOpacity: 1,
              weight: 2,
            }}
            eventHandlers={{
              click: () => {
                if (interactive && onStopClick) {
                  onStopClick(stop);
                }
              },
            }}
          >
            <Tooltip sticky>
              <div className="font-semibold">{stop.stop_name || "Unnamed Stop"}</div>
              <div className="text-xs text-muted-foreground mt-1 capitalize">
                {stop.status}
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
}
