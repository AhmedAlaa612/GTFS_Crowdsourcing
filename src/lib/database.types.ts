// Types matching the GTFS-aligned Supabase schema

export type EntityStatus = 'existing' | 'pending' | 'approved' | 'rejected';
export type UserRole = 'viewer' | 'editor' | 'reviewer';

// --- GTFS Core Tables ---

export interface Agency {
  agency_id: string;
  agency_name: string;
  agency_url: string | null;
  agency_timezone: string;
}

export interface CalendarEntry {
  service_id: string;
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
  saturday: number;
  sunday: number;
  start_date: string;
  end_date: string;
}

export interface FeedInfo {
  feed_publisher_name: string | null;
  feed_publisher_url: string | null;
  feed_contact_url: string | null;
  feed_start_date: string | null;
  feed_end_date: string | null;
  feed_version: string | null;
  feed_lang: string | null;
}

export interface Route {
  route_id: string;
  agency_id: string | null;
  route_long_name: string;
  route_long_name_ar: string | null;
  route_short_name: string | null;
  route_short_name_ar: string | null;
  route_type: number;
  continuous_pickup: number | null;
  continuous_drop_off: number | null;
  status: EntityStatus;
  contributor_id: string | null;
  created_at: string;
}

export interface Stop {
  stop_id: string;
  stop_name: string;
  stop_name_ar: string | null;
  stop_lat: number;
  stop_lon: number;
  status: EntityStatus;
  contributor_id: string | null;
  created_at: string;
}

export interface Trip {
  trip_id: string;
  route_id: string;
  service_id: string;
  trip_headsign: string | null;
  trip_headsign_ar: string | null;
  direction_id: number;
  shape_id: string | null;
  main_streets: string | null;
  main_streets_ar: string | null;
  status: EntityStatus;
  contributor_id: string | null;
  reviewer_id: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  parent_trip_id: string | null;
}

export interface StopTime {
  id: string;
  trip_id: string;
  stop_id: string;
  stop_sequence: number;
  arrival_time: string | null;
  departure_time: string | null;
  timepoint: number;
}

export interface TripShape {
  trip_id: string;
  geojson: GeoJSON.LineString;
}

export interface Fare {
  route_id: string;
  amount: number | null;
  currency: string;
}

export interface Profile {
  id: string;
  role: UserRole;
}

// --- Joins ---

export interface TripWithRoute extends Trip {
  route?: Route;
}

export interface StopTimeWithStop extends StopTime {
  stop?: Stop;
}

// --- Agency ID to vehicle type mapping ---

export const AGENCY_VEHICLE_MAP: Record<string, { en: string; ar: string }> = {
  'P_O_14': { en: 'Microbus', ar: 'ميكروباص' },
  'P_B_8': { en: 'Tomnaya', ar: 'تومناية' },
  'Bus': { en: 'Bus', ar: 'اتوبيس' },
  'Minibus': { en: 'Minibus', ar: 'ميني باص' },
  'COOP': { en: 'Cooperative', ar: 'تعاوني' },
};

// --- Database type map for Supabase client ---

export interface Database {
  public: {
    Tables: {
      agencies: {
        Row: Agency;
        Insert: Agency;
        Update: Partial<Agency>;
      };
      calendar: {
        Row: CalendarEntry;
        Insert: CalendarEntry;
        Update: Partial<CalendarEntry>;
      };
      feed_info: {
        Row: FeedInfo;
        Insert: Partial<FeedInfo>;
        Update: Partial<FeedInfo>;
      };
      routes: {
        Row: Route;
        Insert: Omit<Route, 'created_at'> & { created_at?: string };
        Update: Partial<Route>;
      };
      stops: {
        Row: Stop;
        Insert: Omit<Stop, 'created_at'> & { created_at?: string };
        Update: Partial<Stop>;
      };
      trips: {
        Row: Trip;
        Insert: Omit<Trip, 'created_at'> & { created_at?: string };
        Update: Partial<Trip>;
      };
      stop_times: {
        Row: StopTime;
        Insert: Omit<StopTime, 'id'> & { id?: string };
        Update: Partial<StopTime>;
      };
      trip_shapes: {
        Row: TripShape;
        Insert: TripShape;
        Update: Partial<TripShape>;
      };
      fares: {
        Row: Fare;
        Insert: Fare;
        Update: Partial<Fare>;
      };
      profiles: {
        Row: Profile;
        Insert: Profile;
        Update: Partial<Profile>;
      };
    };
    Enums: {
      entity_status: EntityStatus;
    };
  };
}