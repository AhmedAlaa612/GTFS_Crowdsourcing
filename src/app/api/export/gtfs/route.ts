import { NextResponse } from 'next/server';
import { buildGtfsZip } from '@/lib/gtfs-export';

export async function GET() {
  try {
    const zip = await buildGtfsZip();

    return new NextResponse(zip as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="gtfs_export.zip"',
      },
    });
  } catch (error) {
    console.error('GTFS export error:', error);
    return NextResponse.json(
      { error: 'Failed to generate GTFS export' },
      { status: 500 }
    );
  }
}
