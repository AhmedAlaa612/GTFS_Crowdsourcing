const NEARBY_TRIPS_API = process.env.NEXT_PUBLIC_NEARBY_TRIPS_API_URL || process.env.NEARBY_TRIPS_API_URL;

// Matches the actual external API response
export interface NearbyTrip {
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

export interface NearbyTripsResponse {
  query: { lat: number; lon: number; radius_m: number; starts: boolean; epsg: number };
  count: number;
  trips: NearbyTrip[];
}

export async function getNearbyTrips(
  lat: number,
  lon: number,
  radiusM = 1000,
  startsOnly = false
): Promise<NearbyTripsResponse> {
  if (!NEARBY_TRIPS_API) {
    console.warn('NEARBY_TRIPS_API_URL not configured');
    return { query: { lat, lon, radius_m: radiusM, starts: startsOnly, epsg: 32636 }, count: 0, trips: [] };
  }

  try {
    const url = `${NEARBY_TRIPS_API}/nearby-trips?lat=${lat}&lon=${lon}&radius_m=${radiusM}&starts=${startsOnly}`;
    const res = await fetch(url, { next: { revalidate: 60 } });

    if (!res.ok) {
      console.error('Nearby trips API failed:', res.status);
      return { query: { lat, lon, radius_m: radiusM, starts: startsOnly, epsg: 32636 }, count: 0, trips: [] };
    }

    return res.json();
  } catch (error) {
    console.error('Nearby trips API error:', error);
    return { query: { lat, lon, radius_m: radiusM, starts: startsOnly, epsg: 32636 }, count: 0, trips: [] };
  }
}
