'use client';

import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ParsedGpx {
  shape: GeoJSON.LineString;
  waypoints: { lat: number; lon: number; name?: string }[];
}

interface GpxUploadStepProps {
  onShapeReady: (shape: GeoJSON.LineString, stops: { lat: number; lon: number; name?: string }[]) => void;
  onBack: () => void;
}

function parseGpx(text: string): ParsedGpx {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'application/xml');

  // --- Shape: prefer trkpt (track points), fall back to rtept (route points) ---
  let shapePts = Array.from(doc.querySelectorAll('trkpt'));
  if (shapePts.length < 2) shapePts = Array.from(doc.querySelectorAll('rtept'));

  // --- Waypoints: <wpt> elements are named stops, always extract separately ---
  const wptEls = Array.from(doc.querySelectorAll('wpt'));
  const waypoints = wptEls.map((el) => ({
    lat: parseFloat(el.getAttribute('lat') || '0'),
    lon: parseFloat(el.getAttribute('lon') || '0'),
    name: el.querySelector('name')?.textContent?.trim() || undefined,
  }));

  if (shapePts.length >= 2) {
    const coords = shapePts.map((pt) => [
      parseFloat(pt.getAttribute('lon') || '0'),
      parseFloat(pt.getAttribute('lat') || '0'),
    ]);
    return { shape: { type: 'LineString', coordinates: coords }, waypoints };
  }

  // No track/route — use waypoints as both shape and stops
  if (wptEls.length >= 2) {
    const coords = wptEls.map((el) => [
      parseFloat(el.getAttribute('lon') || '0'),
      parseFloat(el.getAttribute('lat') || '0'),
    ]);
    return { shape: { type: 'LineString', coordinates: coords }, waypoints };
  }

  throw new Error('No track, route, or waypoint data found in GPX file.');
}

function parseGeoJson(text: string): ParsedGpx {
  const data = JSON.parse(text);

  // FeatureCollection → extract LineString + Point features
  if (data.type === 'FeatureCollection') {
    let shape: GeoJSON.LineString | null = null;
    const waypoints: { lat: number; lon: number; name?: string }[] = [];

    for (const feature of data.features) {
      if (!shape && feature.geometry?.type === 'LineString') {
        shape = feature.geometry;
      } else if (!shape && feature.geometry?.type === 'MultiLineString') {
        const coords = (feature.geometry.coordinates as number[][][]).flat();
        shape = { type: 'LineString', coordinates: coords };
      } else if (feature.geometry?.type === 'Point') {
        const [lon, lat] = feature.geometry.coordinates;
        waypoints.push({
          lat,
          lon,
          name: feature.properties?.name || feature.properties?.title || undefined,
        });
      }
    }

    if (!shape) throw new Error('No LineString found in GeoJSON FeatureCollection.');
    return { shape, waypoints };
  }

  // Feature wrapping a LineString
  if (data.type === 'Feature' && data.geometry?.type === 'LineString') {
    return { shape: data.geometry, waypoints: [] };
  }

  // Bare LineString
  if (data.type === 'LineString') {
    return { shape: data, waypoints: [] };
  }

  throw new Error('Unsupported GeoJSON format. Expected a LineString.');
}

function fallbackEndpointStops(shape: GeoJSON.LineString) {
  const coords = shape.coordinates;
  const first = coords[0];
  const last = coords[coords.length - 1];
  return [
    { lat: first[1], lon: first[0], name: 'Start (from file)' },
    { lat: last[1], lon: last[0], name: 'End (from file)' },
  ];
}

export function GpxUploadStep({ onShapeReady, onBack }: GpxUploadStepProps) {
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<GeoJSON.LineString | null>(null);
  const [waypoints, setWaypoints] = useState<{ lat: number; lon: number; name?: string }[]>([]);
  const [coordCount, setCoordCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['gpx', 'geojson', 'json'].includes(ext || '')) {
      toast.error('Please upload a .gpx, .geojson, or .json file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        let result: ParsedGpx;
        if (ext === 'gpx') {
          result = parseGpx(text);
        } else {
          result = parseGeoJson(text);
        }
        setFileName(file.name);
        setParsed(result.shape);
        setWaypoints(result.waypoints);
        setCoordCount(result.shape.coordinates.length);
        const wptMsg = result.waypoints.length > 0
          ? `, ${result.waypoints.length} waypoint stop${result.waypoints.length > 1 ? 's' : ''}`
          : '';
        toast.success(`Parsed ${result.shape.coordinates.length} coordinates${wptMsg} from ${file.name}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to parse file');
      }
    };
    reader.readAsText(file);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleContinue = () => {
    if (!parsed) return;
    // Use named waypoints if the file has them; otherwise fall back to start/end endpoints
    const stops = waypoints.length >= 2 ? waypoints : fallbackEndpointStops(parsed);
    onShapeReady(parsed, stops);
  };

  return (
    <div className="space-y-6 max-w-lg mx-auto p-4">
      <div>
        <h2 className="text-xl font-bold">Upload Route File</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Drop a GPX or GeoJSON file — the shape will be imported directly and a reviewer
          will clean up stops.
        </p>
      </div>

      {/* Drop zone */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
          dragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-muted/30'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".gpx,.geojson,.json"
          className="hidden"
          onChange={onFileChange}
        />

        {parsed ? (
          <div className="space-y-2">
            <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="font-semibold text-sm">{fileName}</p>
            <p className="text-xs text-muted-foreground">{coordCount} shape coordinates</p>
            {waypoints.length > 0 ? (
              <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                {waypoints.length} waypoint stop{waypoints.length > 1 ? 's' : ''} detected
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">No waypoints — start/end will be used as stops</p>
            )}
            <p className="text-xs text-primary underline">Click to replace file</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-sm">Drop your file here</p>
              <p className="text-xs text-muted-foreground mt-0.5">or click to browse</p>
            </div>
            <div className="flex gap-2 justify-center flex-wrap">
              {['.gpx', '.geojson', '.json'].map((ext) => (
                <span key={ext} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-mono">
                  {ext}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {parsed && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-700 dark:text-amber-400">
          {waypoints.length >= 2 ? (
            <><strong>Waypoints found:</strong> The {waypoints.length} named waypoints in your file will become the stops. A reviewer can still adjust them.</>
          ) : (
            <><strong>No waypoints:</strong> The start and end points of the track will become placeholder stops. A reviewer will add proper stops along the route.</>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button onClick={handleContinue} disabled={!parsed} className="flex-[2]">
          Preview & Continue
        </Button>
      </div>
    </div>
  );
}