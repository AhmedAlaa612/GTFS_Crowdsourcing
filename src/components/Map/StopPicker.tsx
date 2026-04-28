"use client";

import { useEffect, useState, useMemo } from "react";
import { CircleMarker, Polyline, Tooltip } from "react-leaflet";
import type L from "leaflet";
import type { Stop } from "@/lib/database.types";

export type MappedStop = Stop & {
  id: string;
  name: string | null;
  lat: number;
  lon: number;
};

export interface PickedStop {
  id?: string;
  lat: number;
  lon: number;
  name?: string;
  isExisting?: boolean;
}

interface StopSequenceConfig {
  stop: MappedStop;
  distance: number;
}

interface StopPickerProps {
  map: L.Map | null;
  existingStops: MappedStop[];
  selectedStops: StopSequenceConfig[];
  onSelect: (stop: MappedStop) => void;
  onSelectCoordinate?: (lat: number, lon: number) => void;
  isPickingStart?: boolean;
}

export function StopPicker({
  map,
  existingStops,
  selectedStops,
  onSelect,
  onSelectCoordinate,
  isPickingStart,
}: StopPickerProps) {
  const pathCoordinates = useMemo(() => {
    return selectedStops.map(
      (s) => [s.stop.lat, s.stop.lon] as [number, number],
    );
  }, [selectedStops]);

  return (
    <>
      {/* Route line connecting selected stops */}
      {pathCoordinates.length > 1 && (
        <Polyline
          positions={pathCoordinates}
          pathOptions={{ color: "#2563eb", weight: 4, dashArray: "10, 10" }}
        />
      )}

      {/* Available existing stops to pick */}
      {existingStops.map((stop) => {
        const isSelected = selectedStops.some((s) => s.stop.id === stop.id);
        const isLastSelected =
          selectedStops.length > 0 &&
          selectedStops[selectedStops.length - 1].stop.id === stop.id;

        let color = "#94a3b8"; // default (unselected)
        let radius = 6;
        let weight = 2;

        if (isSelected) {
          color = isLastSelected ? "#2563eb" : "#10b981"; // Current end vs middle
          radius = 8;
          weight = 3;
        }

        return (
          <CircleMarker
            key={stop.id}
            center={[stop.lat, stop.lon]}
            radius={radius}
            pathOptions={{
              color: "white",
              fillColor: color,
              fillOpacity: 1,
              weight,
            }}
            eventHandlers={{
              click: async (e) => {
                const L = (await import("leaflet")).default;
                L.DomEvent.stopPropagation(e as any); // Prevent triggering the map click event
                if (!isSelected) {
                  onSelect(stop);
                }
              },
            }}
          >
            <Tooltip sticky>
              <div className="font-semibold">{stop.stop_name}</div>
              {isSelected ? (
                <div className="text-xs font-medium text-emerald-500">
                  Selected
                </div>
              ) : (
                <div className="text-xs text-muted-foreground mt-1">
                  Click to add to route
                </div>
              )}
            </Tooltip>
          </CircleMarker>
        );
      })}

      {/* Temporary dot for current mouse coordinate could go here if hovered */}
    </>
  );
}
