export interface OsrmResult {
  geojson: GeoJSON.LineString;
  durationSeconds: number;
}

export async function getRouteShape(
  stops: { lat: number; lon: number }[]
): Promise<OsrmResult> {
  if (stops.length < 2) {
    throw new Error('At least 2 stops are required to generate a route shape');
  }

  const coords = stops.map((s) => `${s.lon},${s.lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`OSRM API returned ${res.status}`);
  }

  const data = await res.json();

  if (!data.routes || data.routes.length === 0) {
    throw new Error('OSRM returned no routes');
  }

  const route = data.routes[0];
  return {
    geojson: route.geometry as GeoJSON.LineString,
    durationSeconds: Math.round(route.duration),
  };
}

export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}
