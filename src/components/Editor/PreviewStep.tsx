'use client';

import { useState, useEffect, useCallback } from 'react';
import { Polyline, Marker, Tooltip } from 'react-leaflet';
import { MapView } from '@/components/Map/MapView';
import { Button } from '@/components/ui/button';
import { getRouteShape, formatDuration, type OsrmResult } from '@/lib/osrm';
import type { PickedStop } from '@/components/Map/StopPicker';
import type L from 'leaflet';

interface PreviewStepProps {
  stops: PickedStop[];
  /** Pre-imported shape from GPX/GeoJSON upload. When provided, OSRM is skipped. */
  importedShape?: GeoJSON.LineString;
  onSubmit: (shape: GeoJSON.LineString, durationSeconds: number) => void;
  onBack: () => void;
}

export function PreviewStep({ stops, importedShape, onSubmit, onBack }: PreviewStepProps) {
  const [map, setMap] = useState<L.Map | null>(null);
  const [routeResult, setRouteResult] = useState<OsrmResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [MarkerIcon, setMarkerIcon] = useState<any>(null);

  const handleMapReady = useCallback((m: L.Map) => {
    setMap(m);
  }, []);

  // Downsample coords to at most maxPoints evenly-spaced entries.
  // Keeps the route shape faithful while staying under OSRM's waypoint cap.
  const downsample = (coords: number[][], maxPoints: number): number[][] => {
    if (coords.length <= maxPoints) return coords;
    const step = (coords.length - 1) / (maxPoints - 1);
    return Array.from({ length: maxPoints }, (_, i) => coords[Math.round(i * step)]);
  };

  useEffect(() => {
    const generateShape = async () => {
      setLoading(true);
      setError(null);
      try {
        let waypoints: { lat: number; lon: number }[];

        if (importedShape) {
          // Downsample the raw track to 60 evenly-spaced points so OSRM snaps
          // the full route geometry to the road network — not just the endpoints.
          const sampled = downsample(importedShape.coordinates, 60);
          waypoints = sampled.map(([lon, lat]) => ({ lat, lon }));
        } else {
          waypoints = stops.map((s) => ({ lat: s.lat, lon: s.lon }));
        }

        const result = await getRouteShape(waypoints);
        setRouteResult(result);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to generate route'
        );
      } finally {
        setLoading(false);
      }
    };
    generateShape();
  }, [stops, importedShape]);

  // Fit map and pre-load Leaflet DivIcon factory
  useEffect(() => {
    if (!map || !routeResult) return;

    const coords = routeResult.geojson.coordinates;
    if (coords.length > 0) {
      import('leaflet').then((L) => {
        const bounds = L.default.latLngBounds([]);
        coords.forEach((c) => bounds.extend([c[1], c[0]]));
        map.fitBounds(bounds, { padding: [60, 60] });

        setMarkerIcon(() => (idx: number, isExisting: boolean) =>
          L.default.divIcon({
            className: 'custom-div-icon',
            html: `<div style="
              width: 28px; height: 28px;
              background: ${isExisting ? '#22c55e' : '#f97316'};
              border: 2.5px solid white;
              border-radius: 50%;
              display: flex; align-items: center; justify-content: center;
              font-size: 12px; font-weight: 700; color: white;
              box-shadow: 0 2px 6px rgba(0,0,0,0.35);
            ">${idx + 1}</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          })
        );
      });
    }
  }, [map, routeResult]);

  const isFileImport = !!importedShape;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">
          {isFileImport ? 'Road-snapped Route Preview' : 'Review your segment'}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {isFileImport
            ? 'Your file\'s track points were downsampled and snapped to the road network via OSRM. A reviewer will add proper stops.'
            : 'Make sure the generated path accurately follows the road network.'}
        </p>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg">
          {error}
        </div>
      )}

      {/* Map */}
      <div className="flex-1 relative min-h-[400px]">
        <MapView onMapReady={handleMapReady}>
          {routeResult && (
            <Polyline
              positions={routeResult.geojson.coordinates.map((c) => [c[1], c[0]] as [number, number])}
              pathOptions={{
                color: '#FFD700',
                weight: 4,
                opacity: 0.9,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          )}

          {MarkerIcon && stops.map((stop, idx) => (
            <Marker
              key={idx}
              position={[stop.lat, stop.lon]}
              icon={MarkerIcon(idx, !!stop.isExisting)}
            >
              <Tooltip>{stop.name || `Stop ${idx + 1}`}</Tooltip>
            </Marker>
          ))}
        </MapView>

        {loading && (
          <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex flex-col items-center justify-center z-10">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <span className="text-sm font-medium">{isFileImport ? 'Snapping track to road network…' : 'Generating optimal road path…'}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between p-3 bg-accent rounded-lg">
        <div className="text-sm">
          {isFileImport ? (
            <span className="text-muted-foreground">
              Road-snapped · estimated duration:{' '}
              <span className="font-medium text-foreground">
                {routeResult ? formatDuration(routeResult.durationSeconds) : '--'}
              </span>
            </span>
          ) : (
            <>
              <span className="text-muted-foreground">Estimated duration:</span>
              <span className="ml-2 font-medium">
                {routeResult ? formatDuration(routeResult.durationSeconds) : '--'}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          onClick={() =>
            routeResult &&
            onSubmit(routeResult.geojson, routeResult.durationSeconds)
          }
          disabled={loading || !routeResult || !!error}
        >
          Submit Contribution
        </Button>
      </div>
    </div>
  );
}