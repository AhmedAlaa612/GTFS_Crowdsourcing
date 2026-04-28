import { NextRequest, NextResponse } from 'next/server';
import { getNearbyTrips } from '@/lib/nearby-trips';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const lat = parseFloat(searchParams.get('lat') || '0');
  const lon = parseFloat(searchParams.get('lon') || '0');
  const radiusM = parseInt(searchParams.get('radius_m') || '1000', 10);
  const starts = searchParams.get('starts') === 'true';

  if (!lat || !lon) {
    return NextResponse.json(
      { error: 'lat and lon are required' },
      { status: 400 }
    );
  }

  const result = await getNearbyTrips(lat, lon, radiusM, starts);
  return NextResponse.json(result);
}
