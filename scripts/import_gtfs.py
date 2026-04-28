#!/usr/bin/env python3
"""
GTFS Import Script (GTFS-aligned schema)
=========================================
Reads a GTFS directory (or zip) and seeds Supabase with all tables.

Usage:
    pip install supabase python-dotenv
    python import_gtfs.py ./gtfsAlex/gtfsAlex
    # or
    python import_gtfs.py ./gtfs.zip

Environment variables (in .env):
    SUPABASE_URL         - Supabase project URL
    SUPABASE_SERVICE_KEY  - Supabase service role key
"""

import sys, os, csv, json, tempfile, zipfile
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))

SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
    sys.exit(1)

client = create_client(SUPABASE_URL, SUPABASE_KEY)

BATCH_SIZE = 200


def read_csv(gtfs_dir, filename):
    """Read a GTFS txt file as list of dicts."""
    path = os.path.join(gtfs_dir, filename)
    if not os.path.exists(path):
        print(f"  Skipping {filename} (not found)")
        return []
    with open(path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        # Strip whitespace from headers and values
        rows = []
        for row in reader:
            rows.append({k.strip(): v.strip() if v else '' for k, v in row.items()})
        return rows


def batch_insert(table, rows):
    """Insert rows in batches."""
    total = 0
    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i:i + BATCH_SIZE]
        try:
            client.table(table).insert(batch).execute()
            total += len(batch)
        except Exception as e:
            print(f"  Batch error on {table}, falling back to one-by-one: {e}")
            for item in batch:
                try:
                    client.table(table).insert(item).execute()
                    total += 1
                except Exception as e2:
                    print(f"    Skip row: {e2}")
    return total


def resolve_gtfs_dir(path):
    """If path is a zip, extract; if dir, find GTFS files."""
    if os.path.isfile(path) and path.endswith('.zip'):
        tmp = tempfile.mkdtemp()
        with zipfile.ZipFile(path, 'r') as z:
            z.extractall(tmp)
        # Find dir with stops.txt
        for root, dirs, files in os.walk(tmp):
            if 'stops.txt' in files:
                return root
        return tmp
    elif os.path.isdir(path):
        # Check if stops.txt is here or in a subdir
        if os.path.exists(os.path.join(path, 'stops.txt')):
            return path
        for root, dirs, files in os.walk(path):
            if 'stops.txt' in files:
                return root
    return path


def import_gtfs(gtfs_path):
    gtfs_dir = resolve_gtfs_dir(gtfs_path)
    print(f"Using GTFS dir: {gtfs_dir}")

    # --- Agencies ---
    agencies = read_csv(gtfs_dir, 'agency.txt')
    if agencies:
        rows = [{'agency_id': a['agency_id'], 'agency_name': a['agency_name'],
                 'agency_url': a.get('agency_url', ''), 'agency_timezone': a.get('agency_timezone', 'Africa/Cairo')}
                for a in agencies]
        n = batch_insert('agencies', rows)
        print(f"Imported {n} agencies")

    # --- Calendar ---
    cal = read_csv(gtfs_dir, 'calendar.txt')
    if cal:
        rows = [{'service_id': c['service_id'],
                 'monday': int(c.get('monday', 1)), 'tuesday': int(c.get('tuesday', 1)),
                 'wednesday': int(c.get('wednesday', 1)), 'thursday': int(c.get('thursday', 1)),
                 'friday': int(c.get('friday', 1)), 'saturday': int(c.get('saturday', 1)),
                 'sunday': int(c.get('sunday', 1)),
                 'start_date': c['start_date'], 'end_date': c['end_date']}
                for c in cal]
        n = batch_insert('calendar', rows)
        print(f"Imported {n} calendar entries")

    # --- Feed Info ---
    fi = read_csv(gtfs_dir, 'feed_info.txt')
    if fi:
        row = fi[0]
        client.table('feed_info').insert({
            'feed_publisher_name': row.get('feed_publisher_name', ''),
            'feed_publisher_url': row.get('feed_publisher_url', ''),
            'feed_contact_url': row.get('feed_contact_url', ''),
            'feed_start_date': row.get('feed_start_date', ''),
            'feed_end_date': row.get('feed_end_date', ''),
            'feed_version': row.get('feed_version', ''),
            'feed_lang': row.get('feed_lang', 'en'),
        }).execute()
        print("Imported feed_info")

    # --- Stops ---
    stops = read_csv(gtfs_dir, 'stops.txt')
    if stops:
        rows = [{'stop_id': s['stop_id'], 'stop_name': s['stop_name'],
                 'stop_name_ar': s.get('stop_name_ar', ''),
                 'stop_lat': float(s['stop_lat']), 'stop_lon': float(s['stop_lon']),
                 'status': 'existing'}
                for s in stops]
        n = batch_insert('stops', rows)
        print(f"Imported {n} stops")

    # --- Routes ---
    routes = read_csv(gtfs_dir, 'routes.txt')
    if routes:
        rows = [{'route_id': r['route_id'], 'agency_id': r.get('agency_id', ''),
                 'route_long_name': r.get('route_long_name', ''),
                 'route_long_name_ar': r.get('route_long_name_ar', ''),
                 'route_short_name': r.get('route_short_name', ''),
                 'route_short_name_ar': r.get('route_short_name_ar', ''),
                 'route_type': int(r.get('route_type', 3)),
                 'continuous_pickup': int(r.get('continuous_pickup', 1)),
                 'continuous_drop_off': int(r.get('continuous_drop_off', 1)),
                 'status': 'existing'}
                for r in routes]
        n = batch_insert('routes', rows)
        print(f"Imported {n} routes")

    # --- Trips ---
    trips = read_csv(gtfs_dir, 'trips.txt')
    if trips:
        rows = [{'trip_id': t['trip_id'], 'route_id': t['route_id'],
                 'service_id': t.get('service_id', 'Ground_Daily'),
                 'trip_headsign': t.get('trip_headsign', ''),
                 'trip_headsign_ar': t.get('trip_headsign_ar', ''),
                 'direction_id': int(t.get('direction_id', 0)),
                 'shape_id': t.get('shape_id', ''),
                 'main_streets': t.get('main_streets', ''),
                 'main_streets_ar': t.get('main_streets_ar', ''),
                 'status': 'existing'}
                for t in trips]
        n = batch_insert('trips', rows)
        print(f"Imported {n} trips")

    # --- Stop Times ---
    stop_times = read_csv(gtfs_dir, 'stop_times.txt')
    if stop_times:
        rows = [{'trip_id': st['trip_id'], 'stop_id': st['stop_id'],
                 'stop_sequence': int(st['stop_sequence']),
                 'arrival_time': st.get('arrival_time', ''),
                 'departure_time': st.get('departure_time', ''),
                 'timepoint': int(st.get('timepoint', 0))}
                for st in stop_times]
        n = batch_insert('stop_times', rows)
        print(f"Imported {n} stop_times")

    # --- Shapes ---
    shape_rows = read_csv(gtfs_dir, 'shapes.txt')
    if shape_rows:
        rows = [{'shape_id': s['shape_id'],
                 'shape_pt_lat': float(s['shape_pt_lat']),
                 'shape_pt_lon': float(s['shape_pt_lon']),
                 'shape_pt_sequence': int(s['shape_pt_sequence'])}
                for s in shape_rows]
        print(f"Importing {len(rows)} shape points in batches...")
        n = batch_insert('shapes', rows)
        print(f"Imported {n} shape points")

    # --- Build trip_shapes GeoJSON cache ---
    if trips:
        print("Building trip_shapes GeoJSON cache...")
        # Group shape points by shape_id
        shape_map = {}
        for s in shape_rows:
            sid = s['shape_id']
            if sid not in shape_map:
                shape_map[sid] = []
            shape_map[sid].append((int(s['shape_pt_sequence']), float(s['shape_pt_lon']), float(s['shape_pt_lat'])))

        # Sort each shape's points
        for sid in shape_map:
            shape_map[sid].sort(key=lambda x: x[0])

        ts_rows = []
        for t in trips:
            sid = t.get('shape_id', '')
            if sid and sid in shape_map:
                coords = [[pt[1], pt[2]] for pt in shape_map[sid]]
                geojson = {'type': 'LineString', 'coordinates': coords}
                ts_rows.append({'trip_id': t['trip_id'], 'geojson': geojson})

        if ts_rows:
            n = batch_insert('trip_shapes', ts_rows)
            print(f"Imported {n} trip_shapes")

    print("Done!")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python import_gtfs.py <path_to_gtfs_dir_or_zip>")
        sys.exit(1)
    import_gtfs(sys.argv[1])
