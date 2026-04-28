'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { TripInfoStep, type InputMethod, type TripFormData } from './TripInfoStep';
import { StopPickerStep } from './StopPickerStep';
import { SubmittedStep } from './SubmittedStep';
import type { PickedStop } from '@/components/Map/StopPicker';
import { AGENCY_VEHICLE_MAP } from '@/lib/database.types';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';

const PreviewStep = dynamic(
  () => import('./PreviewStep').then((mod) => mod.PreviewStep),
  { ssr: false }
);

const GpxUploadStep = dynamic(
  () => import('./GpxUploadStep').then((mod) => mod.GpxUploadStep),
  { ssr: false }
);

const STEPS_A = ['Info', 'Stops', 'Preview', 'Done'];
const STEPS_B = ['Info', 'Upload', 'Preview', 'Done'];

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function ContributeWizard() {
  const searchParams = useSearchParams();
  const prefill = searchParams.get('prefill') || '';
  const parentTripId = searchParams.get('edit') || null;

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [form, setForm] = useState<TripFormData>({
    routeLongName: prefill,
    routeLongNameAr: '',
    agencyId: 'P_O_14',
    tripHeadsign: '',
    tripHeadsignAr: '',
    directionId: 0,
    mainStreets: '',
    mainStreetsAr: '',
    fareAmount: '',
    comment: '',
    inputMethod: 'stops',
  });

  const updateForm = (updates: Partial<TripFormData>) => {
    setForm((prev) => ({ ...prev, ...updates }));
  };

  // Stops state
  const [stops, setStops] = useState<PickedStop[]>([]);
  const [importedShape, setImportedShape] = useState<GeoJSON.LineString | undefined>();
  const [importedStops, setImportedStops] = useState<PickedStop[]>([]);
  const [loadingEdit, setLoadingEdit] = useState(!!parentTripId);

  useEffect(() => {
    if (!parentTripId) return;
    const loadTrip = async () => {
      try {
        const db = createClient();
        const { data: trip } = await db.from('trips').select('*').eq('trip_id', parentTripId).single();
        if (!trip) return;

        const { data: route } = await db.from('routes').select('*').eq('route_id', trip.route_id).single();
        const { data: fare } = await db.from('fares').select('*').eq('route_id', trip.route_id).single();
        const { data: stopTimes } = await db.from('stop_times').select('*').eq('trip_id', parentTripId).order('stop_sequence');
        const stopIds = (stopTimes || []).map((st: any) => st.stop_id);
        const { data: stopsData } = await db.from('stops').select('*').in('stop_id', stopIds);
        const { data: shape } = await db.from('trip_shapes').select('*').eq('trip_id', parentTripId).single();

        setForm(prev => ({
          ...prev,
          routeLongName: route?.route_long_name || prev.routeLongName,
          routeLongNameAr: route?.route_long_name_ar || '',
          agencyId: route?.agency_id || 'P_O_14',
          tripHeadsign: trip.trip_headsign || '',
          tripHeadsignAr: trip.trip_headsign_ar || '',
          directionId: trip.direction_id || 0,
          mainStreets: trip.main_streets || '',
          mainStreetsAr: trip.main_streets_ar || '',
          fareAmount: fare?.amount ? String(fare.amount) : '',
          inputMethod: shape ? 'file' : 'stops',
        }));

        if (stopTimes && stopsData) {
          const mappedStops: PickedStop[] = stopTimes.map((st: any) => {
            const stop = stopsData.find((s: any) => s.stop_id === st.stop_id);
            return {
              id: stop?.stop_id,
              lat: stop?.stop_lat || 0,
              lon: stop?.stop_lon || 0,
              name: stop?.stop_name,
              isExisting: true
            };
          });
          
          if (shape) {
             setImportedShape(shape.geojson);
             setImportedStops(mappedStops);
          } else {
             setStops(mappedStops);
          }
        }
      } catch (err) {
        console.error('Failed to load edit trip:', err);
      } finally {
        setLoadingEdit(false);
      }
    };
    loadTrip();
  }, [parentTripId]);

  const supabase = createClient();
  const STEPS = form.inputMethod === 'file' ? STEPS_B : STEPS_A;
  const activeStops = form.inputMethod === 'file' ? importedStops : stops;

  const handleShapeReady = (
    shape: GeoJSON.LineString,
    rawStops: { lat: number; lon: number; name?: string }[]
  ) => {
    setImportedShape(shape);
    setImportedStops(
      rawStops.map((s) => ({ lat: s.lat, lon: s.lon, name: s.name, isExisting: false }))
    );
    setStep(2);
  };

  const handleSubmit = async (
    shape: GeoJSON.LineString,
    durationSeconds: number
  ) => {
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('You must be logged in to submit'); return; }

      const vehicle = AGENCY_VEHICLE_MAP[form.agencyId] || { en: 'Microbus', ar: 'ميكروباص' };

      // 1. Create route
      const routeId = generateId();
      const { error: routeErr } = await supabase.from('routes').insert({
        route_id: routeId,
        agency_id: form.agencyId,
        route_long_name: form.routeLongName,
        route_long_name_ar: form.routeLongNameAr || null,
        route_short_name: vehicle.en,
        route_short_name_ar: vehicle.ar,
        route_type: 3,
        continuous_pickup: 1,
        continuous_drop_off: 1,
        status: 'pending' as const,
        contributor_id: user.id,
      } as any);
      if (routeErr) throw routeErr;

      // 2. Create trip
      const tripId = generateId();
      const shapeId = tripId + '_Shape';
      const { error: tripErr } = await supabase.from('trips').insert({
        trip_id: tripId,
        route_id: routeId,
        service_id: 'Ground_Daily',
        trip_headsign: form.tripHeadsign,
        trip_headsign_ar: form.tripHeadsignAr || null,
        direction_id: form.directionId,
        shape_id: shapeId,
        main_streets: form.mainStreets || null,
        main_streets_ar: form.mainStreetsAr || null,
        status: 'pending' as const,
        contributor_id: user.id,
        parent_trip_id: parentTripId,
        ...(form.comment.trim() ? { review_note: form.comment.trim() } : {}),
      } as any);
      if (tripErr) throw tripErr;

      // 3. Insert stops + stop_times
      const stopTimesInserts: any[] = [];
      for (let i = 0; i < activeStops.length; i++) {
        const pickedStop = activeStops[i];
        let stopId: string;

        if (pickedStop.isExisting && pickedStop.id) {
          stopId = pickedStop.id;
        } else {
          stopId = String(Date.now()) + '_' + i;
          const { error: stopErr } = await supabase.from('stops').insert({
            stop_id: stopId,
            stop_name: pickedStop.name || 'Unnamed Stop',
            stop_name_ar: null,
            stop_lat: pickedStop.lat,
            stop_lon: pickedStop.lon,
            status: 'pending' as const,
            contributor_id: user.id,
          } as any);
          if (stopErr) throw stopErr;
        }

        stopTimesInserts.push({
          trip_id: tripId,
          stop_id: stopId,
          stop_sequence: i + 1,
          arrival_time: null,
          departure_time: null,
          timepoint: 0,
        });
      }

      if (stopTimesInserts.length > 0) {
        const { error: stErr } = await supabase.from('stop_times').insert(stopTimesInserts as any);
        if (stErr) throw stErr;
      }

      // 4. Insert trip_shapes (GeoJSON cache)
      const { error: shapeErr } = await supabase.from('trip_shapes').insert({
        trip_id: tripId,
        geojson: shape as unknown as Record<string, unknown>,
      } as any);
      if (shapeErr) throw shapeErr;

      // 5. Insert raw shape points
      const shapePoints = shape.coordinates.map((coord, idx) => ({
        shape_id: shapeId,
        shape_pt_lat: coord[1],
        shape_pt_lon: coord[0],
        shape_pt_sequence: idx + 1,
      }));
      // batch in chunks of 200
      for (let i = 0; i < shapePoints.length; i += 200) {
        await supabase.from('shapes').insert(shapePoints.slice(i, i + 200) as any);
      }

      // 6. Insert fare
      if (form.fareAmount && !isNaN(parseFloat(form.fareAmount))) {
        await supabase.from('fares').insert({
          route_id: routeId,
          amount: parseFloat(form.fareAmount),
          currency: 'EGP',
        } as any);
      }

      toast.success('Contribution submitted successfully!');
      setStep(3);
    } catch (err) {
      console.error('Submit error:', err);
      toast.error('Failed to submit contribution. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingEdit) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-muted-foreground text-sm">Loading trip data...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Stepper */}
      {step < 3 && (
        <div className="px-4 py-3 border-b border-border/50 bg-background/95 backdrop-blur-sm">
          <div className="flex items-center justify-center gap-2 max-w-lg mx-auto">
            {STEPS.slice(0, 3).map((label, idx) => (
              <div key={label} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    idx <= step
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {idx + 1}
                </div>
                <span
                  className={`text-sm hidden sm:inline ${
                    idx <= step
                      ? 'text-foreground font-medium'
                      : 'text-muted-foreground'
                  }`}
                >
                  {label}
                </span>
                {idx < 2 && (
                  <div
                    className={`w-8 h-0.5 ${
                      idx < step ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step content */}
      <div className="flex-1 overflow-hidden">
        {step === 0 && (
          <div className="p-6 overflow-y-auto h-full">
            <TripInfoStep
              form={form}
              onChange={updateForm}
              onNext={() => setStep(1)}
            />
          </div>
        )}

        {step === 1 && form.inputMethod === 'stops' && (
          <StopPickerStep
            stops={stops}
            onStopsChange={setStops}
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
          />
        )}

        {step === 1 && form.inputMethod === 'file' && (
          <div className="p-6 overflow-y-auto h-full">
            <GpxUploadStep
              onShapeReady={handleShapeReady}
              onBack={() => setStep(0)}
            />
          </div>
        )}

        {step === 2 && (
          <div className="p-6 overflow-y-auto h-full">
            <PreviewStep
              stops={activeStops}
              importedShape={form.inputMethod === 'file' ? importedShape : undefined}
              onSubmit={handleSubmit}
              onBack={() => setStep(1)}
            />
          </div>
        )}

        {step === 3 && <SubmittedStep />}
      </div>

      {/* Submitting overlay */}
      {submitting && (
        <div className="fixed inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-background border border-border/50 rounded-xl p-8 shadow-xl flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="font-medium">Submitting your contribution...</p>
          </div>
        </div>
      )}
    </div>
  );
}