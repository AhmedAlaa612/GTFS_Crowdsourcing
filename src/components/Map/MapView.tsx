"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import { useMap as useLeafletMap, useMapEvents } from "react-leaflet";
import type L from "leaflet";

const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-gray-800 text-white">
        Loading map...
      </div>
    ),
  },
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false },
);

function MapReadyCatcher({ onMapReady }: { onMapReady: (map: L.Map) => void }) {
  const map = useLeafletMap();
  useEffect(() => {
    if (map) onMapReady(map);
  }, [map, onMapReady]);
  return null;
}

function ClickCatcher({
  onClick,
}: {
  onClick: (lngLat: { lng: number; lat: number }) => void;
}) {
  useMapEvents({
    click(e) {
      onClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

const DEFAULT_CENTER: [number, number] = [31.2001, 29.9187];
const DEFAULT_ZOOM = 12;

// Tile layer options
const TILE_LAYERS = {
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    label: "🌙",
  },
  light: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    label: "☀️",
  },
};

interface MapViewProps {
  onMapReady?: (map: L.Map) => void;
  onClick?: (lngLat: { lng: number; lat: number }) => void;
  cursor?: string;
  children?: React.ReactNode;
  className?: string;
}

export function MapView({
  onMapReady,
  onClick,
  cursor,
  children,
  className = "",
}: MapViewProps) {
  const [mounted, setMounted] = useState(false);
  const [tileTheme, setTileTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    (async () => {
      if (typeof window !== "undefined") {
        const L = (await import("leaflet")).default;
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
          iconUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
          shadowUrl:
            "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
        });
        setMounted(true);
      }
    })();
  }, []);

  if (!mounted) return null;

  const tile = TILE_LAYERS[tileTheme];

  return (
    <div
      className={`relative w-full h-full z-0 ${className}`}
      style={{ cursor: cursor || "default", minHeight: className?.includes('absolute') ? undefined : '400px' }}
    >
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        maxZoom={20}
        className="w-full h-full absolute inset-0 z-0"
        zoomControl={true}
      >
        <TileLayer
          key={tileTheme}
          attribution={tile.attribution}
          url={tile.url}
          maxZoom={20}
          maxNativeZoom={19}
        />
        {onMapReady && <MapReadyCatcher onMapReady={onMapReady} />}
        {onClick && <ClickCatcher onClick={onClick} />}
        {children}
      </MapContainer>

      {/* Light/Dark toggle button */}
      <button
        onClick={() => setTileTheme((t) => (t === "dark" ? "light" : "dark"))}
        className="absolute bottom-6 right-4 z-20 w-9 h-9 rounded-lg border border-border/60 bg-background/90 backdrop-blur-sm shadow-md flex items-center justify-center text-base hover:bg-accent transition-colors"
        title={tileTheme === "dark" ? "Switch to light map" : "Switch to dark map"}
        style={{ zIndex: 1000 }}
      >
        {tileTheme === "dark" ? "☀️" : "🌙"}
      </button>
    </div>
  );
}

export function useMap() {
  const mapRef = useRef<L.Map | null>(null);

  const setMap = useCallback((map: L.Map) => {
    mapRef.current = map;
  }, []);

  return { map: mapRef, setMap };
}
