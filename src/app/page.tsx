"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type L from "leaflet";
import Link from "next/link";
import { MapView } from "@/components/Map/MapView";
import { SidebarDrawer } from "@/components/Sidebar/SidebarDrawer";
import { TripDetail } from "@/components/Sidebar/TripDetail";
import { NearbyTripsPanel } from "@/components/Sidebar/NearbyTripsPanel";
import { GapChecklist } from "@/components/Sidebar/GapChecklist";
import { RoutesPanel } from "@/components/Sidebar/RoutesPanel";
import { AuthButton } from "@/components/Auth/AuthButton";
import { createClient } from "@/lib/supabase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  Stop,
  Trip,
  Route,
  TripShape,
  Fare,
  StopTime,
} from "@/lib/database.types";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import dynamic from "next/dynamic";
const StopLayer = dynamic(
  () => import("@/components/Map/StopLayer").then((mod) => mod.StopLayer),
  { ssr: false }
);
const RouteLayer = dynamic(
  () => import("@/components/Map/RouteLayer").then((mod) => mod.RouteLayer),
  { ssr: false }
);
const supabase = createClient();

function PublicViewContent() {
  const searchParams = useSearchParams();
  const [map, setMap] = useState<L.Map | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string>("viewer");

  // Data
  const [stops, setStops] = useState<Stop[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [shapes, setShapes] = useState<TripShape[]>([]);
  const [fares, setFares] = useState<Fare[]>([]);
  const [stopTimesData, setStopTimesData] = useState<StopTime[]>([]);

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [nearbyPoint, setNearbyPoint] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [sidebarTab, setSidebarTab] = useState<"trip" | "nearby" | "gap">(
    "trip",
  );

  // Handle toast from redirects
  useEffect(() => {
    const toastType = searchParams.get("toast");
    if (toastType === "login_required") {
      toast.error("Please log in to continue");
    } else if (toastType === "editor_required") {
      toast.error("You need editor access to contribute");
    } else if (toastType === "reviewer_required") {
      toast.error("You need reviewer access for this page");
    }
  }, [searchParams]);

  // Load and sync user
  useEffect(() => {
    const fetchRole = async (userId: string) => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .single();
        if (data?.role) {
          setUserRole(data.role);
        } else {
          setUserRole("editor");
        }
      } catch (err) {
        console.error("Error fetching role", err);
        setUserRole("editor");
      }
    };

    supabase.auth.getUser().then((response: any) => {
      const user = response.data.user;
      if (user) {
        setUser(user);
        fetchRole(user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      const currentUser = session?.user || null;
      setUser(currentUser);
      if (currentUser) {
        fetchRole(currentUser.id);
      } else {
        setUserRole("viewer");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load map data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [
          stopsRes,
          routesRes,
          tripsRes,
          shapesRes,
          faresRes,
          stopTimesRes,
        ] = await Promise.all([
          supabase.from("stops").select("*"),
          supabase.from("routes").select("*").in("status", ["approved", "existing"]),
          supabase.from("trips").select("*").in("status", ["approved", "existing"]),
          supabase.from("trip_shapes").select("*"),
          supabase.from("fares").select("*"),
          supabase.from("stop_times").select("*").order("stop_sequence"),
        ]);

        if (stopsRes.error) throw stopsRes.error;

        if (stopsRes.data) setStops(stopsRes.data);
        if (routesRes.data) setRoutes(routesRes.data);
        if (tripsRes.data) setTrips(tripsRes.data);
        if (shapesRes.data) setShapes(shapesRes.data);
        if (faresRes.data) setFares(faresRes.data);
        if (stopTimesRes.data) setStopTimesData(stopTimesRes.data);
      } catch (err) {
        console.error("Data load error:", err);
        toast.error(
          "Failed to load map data. Check your connection or Supabase settings.",
        );
      }
    };
    loadData();
  }, []);

  const handleMapReady = useCallback((m: L.Map) => {
    setMap(m);
  }, []);

  const handleTripClick = useCallback((trip: Trip) => {
    setSelectedTrip(trip);
    setSelectedStop(null);
    setNearbyPoint(null);
    setSidebarTab("trip");
    setSidebarOpen(true);

    if (map) {
      import("leaflet").then((L) => {
        const shape = shapes.find((s) => s.trip_id === trip.trip_id);
        const bounds = L.default.latLngBounds([]);
        if (shape?.geojson?.coordinates?.length) {
          shape.geojson.coordinates.forEach((pt: any) => bounds.extend([pt[1], pt[0]]));
        } else {
          const stopIds = stopTimesData
            .filter((st) => st.trip_id === trip.trip_id)
            .map((st) => st.stop_id);
          stops
            .filter((s) => stopIds.includes(s.stop_id))
            .forEach((s) => bounds.extend([s.stop_lat, s.stop_lon]));
        }
        if (bounds.isValid()) map.flyToBounds(bounds, { padding: [60, 60], duration: 0.8 });
      });
    }
  }, [map, shapes, stops, stopTimesData]);

  const handleStopClick = useCallback((stop: Stop) => {
    setSelectedStop(stop);
    setSelectedTrip(null);
    setNearbyPoint(null);
    setSidebarTab("gap");
    setSidebarOpen(true);
  }, []);

  const handleMapClick = useCallback((lngLat: { lng: number; lat: number }) => {
    setNearbyPoint({ lat: lngLat.lat, lon: lngLat.lng });
    setSelectedTrip(null);
    setSelectedStop(null);
    setSidebarTab("nearby");
    setSidebarOpen(true);
  }, []);

  // Get trip stops for selected trip
  const selectedTripStops = selectedTrip
    ? (stopTimesData
      .filter((st) => st.trip_id === selectedTrip.trip_id)
      .sort((a, b) => a.stop_sequence - b.stop_sequence)
      .map((st) => stops.find((s) => s.stop_id === st.stop_id))
      .filter(Boolean) as Stop[])
    : [];

  const selectedRoute = selectedTrip
    ? routes.find((r) => r.route_id === selectedTrip.route_id) || null
    : null;

  const selectedFare = selectedRoute
    ? fares.find((f) => f.route_id === selectedRoute.route_id) || null
    : null;

  const selectedStopTimes = selectedTrip
    ? stopTimesData
      .filter((st) => st.trip_id === selectedTrip.trip_id)
      .sort((a, b) => a.stop_sequence - b.stop_sequence)
    : [];

  // Adapt trips for RouteLayer (it expects trip.id for shape matching)
  // We create adapted objects that bridge the old/new interface
  const tripsForLayer = trips.map(t => ({
    ...t,
    id: t.trip_id,
    name: routes.find(r => r.route_id === t.route_id)?.route_long_name || t.trip_headsign || t.trip_id,
  }));

  const shapesForLayer = shapes.map(s => ({
    ...s,
    trip_id: s.trip_id,
  }));

  // Adapt stops for StopLayer (expects stop.id, stop.lat, stop.lon)
  const stopsForLayer = stops.map(s => ({
    ...s,
    id: s.stop_id,
    name: s.stop_name,
    lat: s.stop_lat,
    lon: s.stop_lon,
  }));

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="h-14 border-b border-border/50 bg-background/95 backdrop-blur-xl flex items-center justify-between px-4 z-30 relative">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-bold text-lg hidden sm:inline">
              Alexandria GTFS Editor
            </span>
          </Link>
        </div>

        <nav className="flex items-center gap-2">
          {(userRole === "editor" || userRole === "reviewer") && (
            <Link
              href="/contribute"
              className="text-sm px-3 py-1.5 rounded-md hover:bg-accent transition-colors font-medium"
            >
              + Contribute
            </Link>
          )}
          {userRole === "reviewer" && (
            <Link
              href="/review"
              className="text-sm px-3 py-1.5 rounded-md hover:bg-accent transition-colors font-medium"
            >
              Review
            </Link>
          )}
          <AuthButton initialUser={user} />
        </nav>
      </header>

      {/* Map */}
      <div className="flex-1 relative">
        <MapView onMapReady={handleMapReady} onClick={handleMapClick}>
          {map && (
            <>
              {selectedTrip ? (
                <>
                  <RouteLayer
                    trips={tripsForLayer.filter(t => t.id === selectedTrip.trip_id)}
                    shapes={shapesForLayer as any}
                    onTripClick={(t: any) => {
                      const real = trips.find(tr => tr.trip_id === t.id);
                      if (real) handleTripClick(real);
                    }}
                  />
                  <StopLayer
                    stops={selectedTripStops.map(s => ({ ...s, id: s.stop_id, name: s.stop_name, lat: s.stop_lat, lon: s.stop_lon }))}
                    onStopClick={(s: any) => {
                      const real = stops.find(st => st.stop_id === s.id);
                      if (real) handleStopClick(real);
                    }}
                  />
                </>
              ) : (
                <>
                  <RouteLayer
                    trips={tripsForLayer}
                    shapes={shapesForLayer as any}
                    onTripClick={(t: any) => {
                      const real = trips.find(tr => tr.trip_id === t.id);
                      if (real) handleTripClick(real);
                    }}
                  />
                  <StopLayer
                    stops={stopsForLayer.filter(
                      (s: any) => s.status === "existing" || s.status === "approved",
                    )}
                    onStopClick={(s: any) => {
                      const real = stops.find(st => st.stop_id === s.id);
                      if (real) handleStopClick(real);
                    }}
                  />
                </>
              )}
            </>
          )}
        </MapView>

        {/* Routes search panel */}
        <RoutesPanel
          routes={routes}
          trips={trips}
          fares={fares}
          selectedTripId={selectedTrip?.trip_id ?? null}
          onSelectTrip={handleTripClick}
        />

        {/* Stats badge */}
        <div className="absolute bottom-6 left-4 bg-background/90 backdrop-blur-sm rounded-lg px-3 py-2 border border-border/50 shadow-lg z-20">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>
              <strong className="text-foreground">{routes.length}</strong> routes
            </span>
            <span>
              <strong className="text-foreground">{trips.length}</strong> trips
            </span>
            <span>
              <strong className="text-foreground">{stops.length}</strong> stops
            </span>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <SidebarDrawer
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        title={
          sidebarTab === "trip"
            ? "Trip Details"
            : sidebarTab === "gap"
              ? "مواقف Check"
              : "Nearby Trips"
        }
      >
        <Tabs
          value={sidebarTab}
          onValueChange={(v) => setSidebarTab(v as typeof sidebarTab)}
        >
          <TabsList className="w-full">
            <TabsTrigger value="trip" className="flex-1">
              Trip
            </TabsTrigger>
            <TabsTrigger value="nearby" className="flex-1">
              Nearby
            </TabsTrigger>
            <TabsTrigger value="gap" className="flex-1">
              مواقف
            </TabsTrigger>
          </TabsList>

          <TabsContent value="trip" className="mt-4">
            {selectedTrip ? (
              <TripDetail
                trip={selectedTrip}
                route={selectedRoute}
                stops={selectedTripStops}
                stopTimes={selectedStopTimes}
                fare={selectedFare}
                userRole={userRole}
              />
            ) : (
              <p className="text-sm text-muted-foreground py-4">
                Click a route on the map to see details
              </p>
            )}
          </TabsContent>

          <TabsContent value="nearby" className="mt-4">
            {nearbyPoint ? (
              <NearbyTripsPanel
                lat={nearbyPoint.lat}
                lon={nearbyPoint.lon}
                isLoggedIn={!!user}
              />
            ) : (
              <p className="text-sm text-muted-foreground py-4">
                Click anywhere on the map to find nearby trips
              </p>
            )}
          </TabsContent>

          <TabsContent value="gap" className="mt-4">
            {selectedStop ? (
              <GapChecklist stop={selectedStop as any} />
            ) : (
              <p className="text-sm text-muted-foreground py-4">
                Click a stop on the map to check for gaps
              </p>
            )}
          </TabsContent>
        </Tabs>
      </SidebarDrawer>
    </div>
  );
}

export default function PublicViewPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center">
          Loading...
        </div>
      }
    >
      <PublicViewContent />
    </Suspense>
  );
}