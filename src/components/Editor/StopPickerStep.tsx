'use client';

import { useState, useEffect, useCallback } from 'react';
import type L from 'leaflet';
import { MapView } from '@/components/Map/MapView';
import dynamic from 'next/dynamic';
import type { PickedStop, MappedStop } from '@/components/Map/StopPicker';

import { StopSequenceList } from './StopSequenceList';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const StopPicker = dynamic(
  () => import('@/components/Map/StopPicker').then((mod) => mod.StopPicker),
  { ssr: false }
);

interface StopPickerStepProps {
  stops: PickedStop[];
  onStopsChange: (stops: PickedStop[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StopPickerStep({
  stops,
  onStopsChange,
  onNext,
  onBack,
}: StopPickerStepProps) {
  const [existingStops, setExistingStops] = useState<MappedStop[]>([]);
  const [map, setMap] = useState<L.Map | null>(null);
  const [loading, setLoading] = useState(true);

  // Load existing stops globally
  useEffect(() => {
    const loadStops = async () => {
      try {
        const { createClient } = await import('@/lib/supabase');
        const supabase = createClient();
        const { data, error } = await supabase.from('stops').select('*');
        if (error) throw error;
        const mappedStops = (data || []).map((s: any) => ({
          ...s,
          id: s.stop_id,
          name: s.stop_name,
          lat: s.stop_lat,
          lon: s.stop_lon,
        }));
        setExistingStops(mappedStops);
      } catch (err) {
        console.error('Failed to load stops:', err);
        toast.error('Failed to load existing stops');
      } finally {
        setLoading(false);
      }
    };
    loadStops();
  }, []);

  const handleMapReady = useCallback((m: L.Map) => {
    setMap(m);
  }, []);

  const handleStopSelect = useCallback(
    (stop: MappedStop) => {
      onStopsChange([
        ...stops,
        {
          id: stop.id,
          lat: stop.lat,
          lon: stop.lon,
          name: stop.name || undefined,
          isExisting: true,
        },
      ]);
    },
    [stops, onStopsChange]
  );

  const handleCoordinateSelect = useCallback(
    (lat: number, lon: number) => {
      onStopsChange([
        ...stops,
        { lat, lon, isExisting: false },
      ]);
    },
    [stops, onStopsChange]
  );

  const isValid = stops.length >= 2;

  // Render picked stops into StopSequenceConfig type internally
  const mappedStops = stops.map(stop => ({
    stop: {
      id: stop.id || 'custom-' + stop.lat + stop.lon,
      lat: stop.lat,
      lon: stop.lon,
      name: stop.name || 'New Stop ' + stop.lat.toFixed(4) + ', ' + stop.lon.toFixed(4),
      status: stop.isExisting ? 'existing' : 'proposed',
    } as any,
    distance: 0,
  }));

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] md:h-[600px] md:flex-row gap-4">
      {/* Map Side */}
      <div className="flex-1 relative rounded-lg overflow-hidden border border-border h-full min-h-[400px]">
        <MapView onMapReady={handleMapReady} onClick={handleCoordinateSelect ? (lngLat) => handleCoordinateSelect(lngLat.lat, lngLat.lng) : undefined}>
          {map && existingStops.length > 0 && (
            <StopPicker
              map={map}
              existingStops={existingStops}
              selectedStops={mappedStops}
              onSelect={handleStopSelect}
              onSelectCoordinate={handleCoordinateSelect}
              isPickingStart={stops.length === 0}
            />
          )}
        </MapView>
        
        {loading && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center backdrop-blur-[1px]">
             <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        )}

        <div className="absolute top-4 left-4 right-4 bg-background/90 backdrop-blur-sm p-3 rounded-lg border border-border shadow-lg z-10 pointer-events-none">
          <p className="text-sm font-medium text-center">
            {stops.length === 0
              ? 'Click a green circle or anywhere on map to add the FIRST stop'
              : 'Keep clicking to build the route sequence'}
          </p>
        </div>
      </div>

      {/* List Side */}
      <div className="w-full md:w-80 flex flex-col h-full bg-card rounded-lg border border-border">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold flex items-center justify-between">
            Sequence
            <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">
              {stops.length}
            </span>
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Drag to reorder
          </p>
        </div>

        <div className="flex-1 overflow-auto p-4 content-visibility-auto">
          <StopSequenceList
            stops={stops}
            onStopsChange={onStopsChange}
          />
        </div>

        <div className="p-4 border-t border-border bg-muted/30">
          <div className="flex justify-between gap-3">
            <Button variant="outline" onClick={onBack} className="flex-1">
              Back
            </Button>
            <Button
               onClick={onNext}
               disabled={!isValid}
               className="flex-[2]"
            >
              {isValid ? 'Preview Route' : 'Need >= 2 stops'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}