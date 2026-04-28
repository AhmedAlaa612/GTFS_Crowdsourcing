-- ============================================================
-- Alexandria GTFS Editor — Fresh Schema (GTFS-aligned)
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Drop everything
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS fares CASCADE;
DROP TABLE IF EXISTS trip_shapes CASCADE;
DROP TABLE IF EXISTS shapes CASCADE;
DROP TABLE IF EXISTS stop_times CASCADE;
DROP TABLE IF EXISTS trips CASCADE;
DROP TABLE IF EXISTS routes CASCADE;
DROP TABLE IF EXISTS stops CASCADE;
DROP TABLE IF EXISTS calendar CASCADE;
DROP TABLE IF EXISTS feed_info CASCADE;
DROP TABLE IF EXISTS agencies CASCADE;
-- Legacy tables
DROP TABLE IF EXISTS trip_stops CASCADE;
DROP TABLE IF EXISTS trip_durations CASCADE;
DROP TYPE IF EXISTS entity_status CASCADE;

-- 2. Enum
CREATE TYPE entity_status AS ENUM ('existing', 'pending', 'approved', 'rejected');

-- 3. Agencies
CREATE TABLE agencies (
  agency_id TEXT PRIMARY KEY,
  agency_name TEXT NOT NULL,
  agency_url TEXT,
  agency_timezone TEXT NOT NULL DEFAULT 'Africa/Cairo'
);

-- 4. Calendar
CREATE TABLE calendar (
  service_id TEXT PRIMARY KEY,
  monday INT NOT NULL DEFAULT 1,
  tuesday INT NOT NULL DEFAULT 1,
  wednesday INT NOT NULL DEFAULT 1,
  thursday INT NOT NULL DEFAULT 1,
  friday INT NOT NULL DEFAULT 1,
  saturday INT NOT NULL DEFAULT 1,
  sunday INT NOT NULL DEFAULT 1,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL
);

-- 5. Feed info
CREATE TABLE feed_info (
  feed_publisher_name TEXT,
  feed_publisher_url TEXT,
  feed_contact_url TEXT,
  feed_start_date TEXT,
  feed_end_date TEXT,
  feed_version TEXT,
  feed_lang TEXT DEFAULT 'en'
);

-- 6. Stops
CREATE TABLE stops (
  stop_id TEXT PRIMARY KEY,
  stop_name TEXT NOT NULL,
  stop_name_ar TEXT,
  stop_lat DOUBLE PRECISION NOT NULL,
  stop_lon DOUBLE PRECISION NOT NULL,
  status entity_status NOT NULL DEFAULT 'existing',
  contributor_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Routes
CREATE TABLE routes (
  route_id TEXT PRIMARY KEY,
  agency_id TEXT REFERENCES agencies(agency_id),
  route_long_name TEXT NOT NULL,
  route_long_name_ar TEXT,
  route_short_name TEXT,
  route_short_name_ar TEXT,
  route_type INT NOT NULL DEFAULT 3,
  continuous_pickup INT DEFAULT 1,
  continuous_drop_off INT DEFAULT 1,
  status entity_status NOT NULL DEFAULT 'existing',
  contributor_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Trips
CREATE TABLE trips (
  trip_id TEXT PRIMARY KEY,
  route_id TEXT NOT NULL REFERENCES routes(route_id) ON DELETE CASCADE,
  service_id TEXT NOT NULL REFERENCES calendar(service_id) DEFAULT 'Ground_Daily',
  trip_headsign TEXT,
  trip_headsign_ar TEXT,
  direction_id INT DEFAULT 0,
  shape_id TEXT,
  main_streets TEXT,
  main_streets_ar TEXT,
  status entity_status NOT NULL DEFAULT 'existing',
  contributor_id UUID REFERENCES auth.users(id),
  reviewer_id UUID REFERENCES auth.users(id),
  review_note TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  parent_trip_id TEXT REFERENCES trips(trip_id) ON DELETE SET NULL
);

-- 9. Stop times
CREATE TABLE stop_times (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id TEXT NOT NULL REFERENCES trips(trip_id) ON DELETE CASCADE,
  stop_id TEXT NOT NULL REFERENCES stops(stop_id),
  stop_sequence INT NOT NULL,
  arrival_time TEXT,
  departure_time TEXT,
  timepoint INT DEFAULT 0,
  UNIQUE(trip_id, stop_sequence)
);

-- 10. Shapes (raw points for GTFS export)
CREATE TABLE shapes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shape_id TEXT NOT NULL,
  shape_pt_lat DOUBLE PRECISION NOT NULL,
  shape_pt_lon DOUBLE PRECISION NOT NULL,
  shape_pt_sequence INT NOT NULL,
  UNIQUE(shape_id, shape_pt_sequence)
);

-- 11. Trip shapes (GeoJSON cache for app display)
CREATE TABLE trip_shapes (
  trip_id TEXT PRIMARY KEY REFERENCES trips(trip_id) ON DELETE CASCADE,
  geojson JSONB NOT NULL
);

-- 12. Fares (per route)
CREATE TABLE fares (
  route_id TEXT PRIMARY KEY REFERENCES routes(route_id) ON DELETE CASCADE,
  amount NUMERIC,
  currency TEXT DEFAULT 'EGP'
);

-- 13. Profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor', 'reviewer'))
);

-- No RLS enabled on any table.
