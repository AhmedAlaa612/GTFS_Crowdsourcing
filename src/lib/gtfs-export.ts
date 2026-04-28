import JSZip from 'jszip';
import { createClient } from '@supabase/supabase-js';
import type { Database, Agency, CalendarEntry, FeedInfo, Route, Stop, Trip, StopTime } from './database.types';

/**
 * Build a GTFS zip from the database that matches the original gtfsAlex format.
 */
export async function buildGtfsZip(): Promise<Buffer> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const supabase = createClient<Database>(url, key);
  const zip = new JSZip();

  // --- agency.txt ---
  const { data: agencies } = (await supabase.from('agencies').select('*')) as { data: Agency[] | null };
  if (agencies?.length) {
    const header = 'agency_id,agency_name,agency_url,agency_timezone';
    const rows = agencies.map(a =>
      `${a.agency_id},${csvEscape(a.agency_name)},${a.agency_url || ''},${a.agency_timezone}`
    );
    zip.file('agency.txt', header + '\n' + rows.join('\n') + '\n');
  }

  // --- calendar.txt ---
  const { data: cal } = (await supabase.from('calendar').select('*')) as { data: CalendarEntry[] | null };
  if (cal?.length) {
    const header = 'monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date,service_id';
    const rows = cal.map(c =>
      `${c.monday},${c.tuesday},${c.wednesday},${c.thursday},${c.friday},${c.saturday},${c.sunday},${c.start_date},${c.end_date},${c.service_id}`
    );
    zip.file('calendar.txt', header + '\n' + rows.join('\n') + '\n');
  }

  // --- feed_info.txt ---
  const { data: fi } = (await supabase.from('feed_info').select('*')) as { data: FeedInfo[] | null };
  if (fi?.length) {
    const f = fi[0];
    const header = 'feed_publisher_name,feed_publisher_url,feed_contact_url,feed_start_date,feed_end_date,feed_version,feed_lang';
    const row = `${f.feed_publisher_name || ''},${f.feed_publisher_url || ''},${f.feed_contact_url || ''},${f.feed_start_date || ''},${f.feed_end_date || ''},${f.feed_version || ''},${f.feed_lang || 'en'}`;
    zip.file('feed_info.txt', header + '\n' + row + '\n');
  }

  // --- routes.txt ---
  const { data: routes } = (await supabase.from('routes').select('*')
    .in('status', ['existing', 'approved'])) as { data: Route[] | null };
  if (routes?.length) {
    const header = 'route_id,agency_id,route_long_name,route_long_name_ar,route_short_name,route_type,continuous_pickup,continuous_drop_off,route_short_name_ar';
    const rows = routes.map(r =>
      `${r.route_id},${r.agency_id || ''},${csvEscape(r.route_long_name)},${csvEscape(r.route_long_name_ar || '')},${csvEscape(r.route_short_name || '')},${r.route_type},${r.continuous_pickup ?? 1},${r.continuous_drop_off ?? 1},${csvEscape(r.route_short_name_ar || '')}`
    );
    zip.file('routes.txt', header + '\n' + rows.join('\n') + '\n');
  }

  // --- stops.txt ---
  const { data: stops } = (await supabase.from('stops').select('*')) as { data: Stop[] | null };
  if (stops?.length) {
    const header = 'stop_id,stop_name,stop_lat,stop_lon,stop_name_ar';
    const rows = stops.map(s =>
      `${s.stop_id},${csvEscape(s.stop_name)},${s.stop_lat},${s.stop_lon},${csvEscape(s.stop_name_ar || '')}`
    );
    zip.file('stops.txt', header + '\n' + rows.join('\n') + '\n');
  }

  // --- trips.txt ---
  const { data: trips } = (await supabase.from('trips').select('*')
    .in('status', ['existing', 'approved'])) as { data: Trip[] | null };
  if (trips?.length) {
    const header = 'route_id,service_id,trip_headsign,direction_id,shape_id,trip_id,trip_headsign_ar,main_streets,main_streets_ar';
    const rows = trips.map(t =>
      `${t.route_id},${t.service_id},${csvEscape(t.trip_headsign || '')},${t.direction_id},${t.shape_id || ''},${t.trip_id},${csvEscape(t.trip_headsign_ar || '')},${csvEscape(t.main_streets || '')},${csvEscape(t.main_streets_ar || '')}`
    );
    zip.file('trips.txt', header + '\n' + rows.join('\n') + '\n');
  }

  // --- stop_times.txt ---
  const { data: stopTimes } = (await supabase.from('stop_times').select('*')
    .order('trip_id').order('stop_sequence')) as { data: StopTime[] | null };
  if (stopTimes?.length) {
    const header = 'trip_id,stop_id,stop_sequence,arrival_time,departure_time,timepoint';
    const rows = stopTimes.map(st =>
      `${st.trip_id},${st.stop_id},${st.stop_sequence},${st.arrival_time || ''},${st.departure_time || ''},${st.timepoint}`
    );
    zip.file('stop_times.txt', header + '\n' + rows.join('\n') + '\n');
  }

  // --- shapes.txt ---
  // Fetch all shape points, ordered
  const allShapePoints: { shape_id: string; shape_pt_sequence: number; shape_pt_lat: number; shape_pt_lon: number }[] = [];
  let offset = 0;
  const PAGE = 1000;
  while (true) {
    const { data } = await supabase.from('shapes').select('shape_id,shape_pt_sequence,shape_pt_lat,shape_pt_lon')
      .order('shape_id').order('shape_pt_sequence')
      .range(offset, offset + PAGE - 1);
    if (!data?.length) break;
    allShapePoints.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  if (allShapePoints.length) {
    const header = 'shape_id,shape_pt_sequence,shape_pt_lat,shape_pt_lon';
    const rows = allShapePoints.map(s =>
      `${s.shape_id},${s.shape_pt_sequence},${s.shape_pt_lat},${s.shape_pt_lon}`
    );
    zip.file('shapes.txt', header + '\n' + rows.join('\n') + '\n');
  }

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  return buffer;
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
