#!/usr/bin/env python3
"""Clear all data from the GTFS-aligned Supabase tables."""

import os, sys
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

# Order matters (foreign key dependencies)
TABLES = [
    'stop_times',
    'trip_shapes',
    'shapes',
    'fares',
    'trips',
    'routes',
    'stops',
    'feed_info',
    'calendar',
    'agencies',
]

for table in TABLES:
    try:
        # Delete all rows. neq filter ensures all rows match.
        client.table(table).delete().neq('id' if table in ('stop_times', 'shapes') else
            'stop_id' if table == 'stops' else
            'route_id' if table in ('routes', 'fares') else
            'trip_id' if table in ('trips', 'trip_shapes') else
            'service_id' if table == 'calendar' else
            'agency_id' if table == 'agencies' else
            'feed_publisher_name', '___NEVER___').execute()
        print(f"Cleared {table}")
    except Exception as e:
        print(f"Error clearing {table}: {e}")

print("Done!")
