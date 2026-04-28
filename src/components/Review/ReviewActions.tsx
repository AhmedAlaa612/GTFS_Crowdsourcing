'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import type { Trip, Stop, Fare, StopTime } from '@/lib/database.types';
import { toast } from 'sonner';
import { getRouteShape } from '@/lib/osrm';
import dynamic from 'next/dynamic';

const MapView = dynamic(
  () => import('@/components/Map/MapView').then((mod) => mod.MapView),
  { ssr: false }
);

const EditMapLayer = dynamic(
  () => import('./EditMapLayer').then((mod) => mod.EditMapLayer),
  { ssr: false }
);

interface ReviewActionsProps {
  trip: Trip;
  tripStops: Stop[];
  fare: Fare | null;
  onActionComplete: () => void;
  onStopsChange: (stops: Stop[]) => void;
  onFareChange: (fare: Fare | null) => void;
  onNameChange?: (name: string) => void;
}

const supabase = createClient();



// ─── Split Editor Modal ───────────────────────────────────────────────────────
export function SplitEditor({
  open,
  onOpenChange,
  trip,
  initialStops,
  fare,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  trip: Trip;
  initialStops: Stop[];
  fare: Fare | null;
  onSave: (stops: Stop[], name: string, fareAmount: string) => Promise<void>;
}) {
  const [editStops, setEditStops] = useState<Stop[]>([]);
  const [editName, setEditName] = useState('');
  const [editFare, setEditFare] = useState('');
  const [allStops, setAllStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [openCount, setOpenCount] = useState(0);

  // Sequence prompt state
  const [pendingMapStop, setPendingMapStop] = useState<Stop | null>(null);
  const [pendingCoord, setPendingCoord] = useState<{ lat: number; lon: number } | null>(null);
  const [showSeqPrompt, setShowSeqPrompt] = useState(false);
  const [seqValue, setSeqValue] = useState('');

  // Highlighted stop (bidirectional sync)
  const [highlightedIdx, setHighlightedIdx] = useState<number | null>(null);
  const listRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    setEditStops([...initialStops]);
    setEditName(trip.name ?? '');
    setEditFare(fare?.amount?.toString() ?? '');
    setHighlightedIdx(null);

    setLoading(true);
    setMapReady(false);
    setOpenCount((c) => c + 1);
    supabase.from('stops').select('*').then(({ data }) => {
      const mapped = (data || []).map((s: any) => ({
        ...s,
        id: s.stop_id,
        name: s.stop_name,
        lat: s.stop_lat,
        lon: s.stop_lon
      }));
      setAllStops(mapped);
      setLoading(false);
    });
    // Delay map mount by one frame so the portal div is in the DOM first
    const t = setTimeout(() => setMapReady(true), 50);
    return () => clearTimeout(t);
  }, [open, initialStops, trip, fare]);

  // Scroll list to highlighted item
  useEffect(() => {
    if (highlightedIdx !== null && listRefs.current[highlightedIdx]) {
      listRefs.current[highlightedIdx]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [highlightedIdx]);

  const handleMapStopClick = (stop: Stop) => {
    if (editStops.some((s) => s.id === stop.id)) {
      toast.info('Stop already in route — remove it from the list first to reposition.');
      return;
    }
    setPendingMapStop(stop);
    setPendingCoord(null);
    setSeqValue(String(editStops.length + 1));
    setShowSeqPrompt(true);
  };

  const handleMapCoordClick = ({ lat, lng }: { lat: number; lng: number }) => {
    if (showSeqPrompt) return;
    setPendingCoord({ lat, lon: lng } as any);
    setPendingMapStop(null);
    setSeqValue(String(editStops.length + 1));
    setShowSeqPrompt(true);
  };

  const handleSequenceConfirm = (seq: number) => {
    setShowSeqPrompt(false);
    const insertIdx = seq - 1;

    if (pendingMapStop) {
      const next = [...editStops];
      next.splice(insertIdx, 0, pendingMapStop);
      setEditStops(next);
      setHighlightedIdx(insertIdx);
    } else if (pendingCoord) {
      const newStop: Stop = {
        id: `new-${Date.now()}`,
        name: '',
        lat: pendingCoord.lat,
        lon: (pendingCoord as any).lon,
        status: 'pending',
        contributor_id: null,
        created_at: new Date().toISOString(),
      };
      const next = [...editStops];
      next.splice(insertIdx, 0, newStop);
      setEditStops(next);
      setHighlightedIdx(insertIdx);
    }

    setPendingMapStop(null);
    setPendingCoord(null);
  };

  const handleSequenceCancel = () => {
    setShowSeqPrompt(false);
    setPendingMapStop(null);
    setPendingCoord(null);
  };

  const moveStop = (idx: number, dir: -1 | 1) => {
    const next = [...editStops];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setEditStops(next);
    setHighlightedIdx(swap);
  };

  const removeStop = (idx: number) => {
    setEditStops((prev) => prev.filter((_, i) => i !== idx));
    setHighlightedIdx(null);
  };

  const updateStopName = (idx: number, name: string) => {
    setEditStops((prev) => prev.map((s, i) => i === idx ? { ...s, name } : s));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(editStops, editName, editFare);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const availableStops = allStops.filter((s) => !editStops.some((es) => es.id === s.id));

  return (
    <>
      {open && createPortal(
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) onOpenChange(false); }}
        >
          <div
            style={{
              width: 'min(1100px, 95vw)',
              height: '90vh',
              display: 'flex',
              flexDirection: 'column',
              background: 'hsl(var(--background))',
              borderRadius: 12,
              overflow: 'hidden',
              boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
            }}
          >
          {/* Header */}
          <div className="flex items-start justify-between px-5 py-3 border-b border-border/60 flex-shrink-0 gap-4">
            <div className="flex flex-col gap-2 flex-1 min-w-0">
              <div className="flex items-end gap-3">
                <div className="flex-1 min-w-0">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Trip Name</label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-8 text-sm mt-1"
                    placeholder="Trip name"
                  />
                </div>
                <div className="w-36 flex-shrink-0">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Fare (EGP)</label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    value={editFare}
                    onChange={(e) => setEditFare(e.target.value)}
                    className="h-8 text-sm mt-1"
                    placeholder="—"
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Click green stops on map to add · Click blank map to create a new stop · Reorder in the list
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0 pt-1">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </div>

          {/* Body */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Map */}
            <div style={{ flex: 1, position: 'relative' }}>
              {mapReady && (
                <MapView onClick={handleMapCoordClick}>
                  <EditMapLayer
                    routeStops={editStops}
                    availableStops={availableStops}
                    highlightedIdx={highlightedIdx}
                    onStopClick={handleMapStopClick}
                    onStopHover={setHighlightedIdx}
                  />
                </MapView>
              )}

              {/* Sequence prompt overlay */}
              {showSeqPrompt && (
                <div style={{
                  position: 'absolute', inset: 0, zIndex: 1000,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(0,0,0,0.4)',
                }}>
                  <div className="bg-background border border-border rounded-xl p-5 shadow-2xl w-72">
                    <p className="font-semibold text-sm mb-1">
                      {pendingMapStop ? `Add "${pendingMapStop.name || 'Stop'}"` : 'New stop'}
                    </p>
                    <p className="text-xs text-muted-foreground mb-3">
                      Insert at position (1 = first):
                    </p>
                    <Input
                      type="number"
                      min={1}
                      max={editStops.length + 1}
                      value={seqValue}
                      onChange={(e) => setSeqValue(e.target.value)}
                      className="mb-3"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSequenceConfirm(Math.max(1, Math.min(editStops.length + 1, parseInt(seqValue) || 1)));
                        if (e.key === 'Escape') handleSequenceCancel();
                      }}
                    />
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={handleSequenceCancel}>Cancel</Button>
                      <Button size="sm" className="flex-1" onClick={() =>
                        handleSequenceConfirm(Math.max(1, Math.min(editStops.length + 1, parseInt(seqValue) || 1)))
                      }>Insert</Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Stop list */}
            <div style={{
              width: 280, display: 'flex', flexDirection: 'column',
              borderLeft: '1px solid hsl(var(--border) / 0.6)', overflow: 'hidden',
            }}>
              <div className="px-3 py-2 border-b border-border/60 flex-shrink-0">
                <p className="text-xs font-medium text-muted-foreground">
                  {editStops.length} stop{editStops.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {editStops.map((stop, idx) => {
                  const isHighlighted = highlightedIdx === idx;
                  const isNew = stop.id.startsWith('new-');
                  return (
                    <div
                      key={stop.id + idx}
                      ref={(el) => { listRefs.current[idx] = el; }}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer group transition-colors ${
                        isHighlighted ? 'bg-amber-400/10 border border-amber-400/30' : 'hover:bg-muted border border-transparent'
                      }`}
                      onClick={() => setHighlightedIdx(isHighlighted ? null : idx)}
                    >
                      <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                        isHighlighted ? 'bg-amber-400' : isNew ? 'bg-orange-500' : 'bg-blue-600'
                      }`}>
                        {idx + 1}
                      </div>

                      {/* Name */}
                      <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                        <Input
                          value={stop.name ?? ''}
                          onChange={(e) => updateStopName(idx, e.target.value)}
                          placeholder={isNew ? 'Name this stop…' : 'Stop name'}
                          className={`h-7 text-xs border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0 ${
                            isNew ? 'placeholder:text-orange-400' : ''
                          }`}
                        />
                        <span className="text-[9px] text-muted-foreground font-mono leading-none">
                          {stop.lat.toFixed(5)}, {stop.lon.toFixed(5)}
                          {isNew && <span className="ml-1 text-orange-400">new</span>}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); moveStop(idx, -1); }}
                          disabled={idx === 0}
                          className="w-5 h-5 flex items-center justify-center rounded hover:bg-muted disabled:opacity-25 text-[10px]"
                          title="Move up"
                        >↑</button>
                        <button
                          onClick={(e) => { e.stopPropagation(); moveStop(idx, 1); }}
                          disabled={idx === editStops.length - 1}
                          className="w-5 h-5 flex items-center justify-center rounded hover:bg-muted disabled:opacity-25 text-[10px]"
                          title="Move down"
                        >↓</button>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeStop(idx); }}
                          className="w-5 h-5 flex items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive text-[10px]"
                          title="Remove"
                        >x</button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-3 border-t border-border/60 flex-shrink-0 bg-muted/30">
                <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
                  Click a list item to highlight it on the map · Changes sync live
                </p>
              </div>
            </div>
          </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// ─── Main ReviewActions ───────────────────────────────────────────────────────
export function ReviewActions({ trip, tripStops, fare, onActionComplete, onStopsChange, onFareChange, onNameChange }: ReviewActionsProps) {
  const [showReject, setShowReject] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSaveEdits = async (editStops: Stop[], editName: string, editFare: string) => {
    setLoading(true);
    try {
      // 1. Trip name
      if (editName !== trip.name) {
        const { error: tErr } = await supabase.from('trips').update({ trip_headsign: editName } as any).eq('trip_id', trip.id);
        if (tErr) throw tErr;

        if ((trip as any).route_id) {
          const { error: rErr } = await supabase.from('routes').update({ route_long_name: editName } as any).eq('route_id', (trip as any).route_id);
          if (rErr) throw rErr;
        }

        if (onNameChange) {
          onNameChange(editName);
        }
      }

      // 2. Fare
      const newAmount = editFare !== '' ? parseFloat(editFare) : null;
      const targetRouteId = (trip as any).route_id || trip.id;
      
      if (fare) {
        await supabase.from('fares').update({ amount: newAmount }).eq('route_id', targetRouteId);
      } else if (newAmount !== null) {
        await supabase.from('fares').insert({ route_id: targetRouteId, amount: newAmount, currency: 'EGP' } as any);
      }
      
      onFareChange(
        fare
          ? { ...fare, amount: newAmount }
          : { id: '', route_id: targetRouteId, amount: newAmount, currency: 'EGP' } as any
      );

      // 3. Handle new stops (id starts with 'new-') and update existing
      const resolvedStops: Stop[] = [];
      for (const stop of editStops) {
        if (stop.id.startsWith('new-')) {
          const newStopId = String(Date.now()) + '_' + Math.random().toString(36).slice(2, 6);
          const { data: inserted, error } = await supabase
            .from('stops')
            .insert({ stop_id: newStopId, stop_name: stop.name, stop_lat: stop.lat, stop_lon: stop.lon, status: 'pending' } as any)
            .select()
            .single();
          if (error) throw error;
          resolvedStops.push(inserted as Stop);
        } else {
          const original = tripStops.find((s) => s.id === stop.id);
          if (original && original.name !== stop.name) {
            await supabase.from('stops').update({ stop_name: stop.name } as any).eq('stop_id', stop.id);
          }
          resolvedStops.push(stop);
        }
      }

      // 4. Rewrite trip_stops sequence
      await supabase.from('stop_times').delete().eq('trip_id', trip.id);
      const inserts = resolvedStops.map((stop, idx) => ({
        trip_id: trip.id,
        stop_id: stop.id,
        stop_sequence: idx + 1,
        arrival_time: null,
        departure_time: null,
        timepoint: 0,
      }));
      if (inserts.length > 0) {
        await supabase.from('stop_times').insert(inserts as any);
      }

      // 5. Always wipe the old shape first so DiffMap never shows a stale path.
      if (resolvedStops.length >= 2) {
        try {
          toast.loading('Regenerating route shape…', { id: 'osrm' });
          const { geojson, durationSeconds } = await getRouteShape(
            resolvedStops.map((s) => ({ lat: s.lat, lon: s.lon }))
          );

          // Use upsert so RLS-blocked deletes can't leave a stale row behind
          const { error: shapeErr } = await supabase.from('trip_shapes').upsert(
            { trip_id: trip.id, geojson: geojson as unknown as Record<string, unknown> },
            { onConflict: 'trip_id' }
          );
          if (shapeErr) throw new Error('Shape upsert failed: ' + shapeErr.message);

          // duration stored implicitly (no trip_durations table in new schema)

          toast.success('Changes saved with updated route.', { id: 'osrm' });
        } catch (osrmErr) {
          console.error('[save] OSRM or shape upsert FAILED:', osrmErr);
          toast.warning('Stops saved, but route path could not be regenerated.', { id: 'osrm' });
        }
      } else {
        // No shape needed — delete any existing one
        await supabase.from('trip_shapes').delete().eq('trip_id', trip.id);
        toast.success('Changes saved.');
      }

      // Signal parent only after every DB write (including shape) is done.
      // This triggers a full DiffMap remount so it fetches the new shape + stops.
      onStopsChange(resolvedStops);
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to save changes.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const parentTripId = (trip as any).parent_trip_id;

      if (parentTripId) {
        // This is an edit submission — write its data onto the original trip ID
        // so the trip ID never changes, then delete the pending copy.

        // 1. Fetch this pending trip's stops, shape, fare, duration
        const [tsRes, shapeRes, fareRes, durRes] = await Promise.all([
          supabase.from('stop_times').select('stop_id, stop_sequence').eq('trip_id', trip.id).order('stop_sequence'),
          supabase.from('trip_shapes').select('*').eq('trip_id', trip.id).single(),
          supabase.from('fares').select('*').eq('route_id', (trip as any).route_id).single(),
          Promise.resolve({ data: null } as any), // no trip_durations table
        ]);

        // Get original trip to find original route_id
        const { data: origTrip } = await supabase.from('trips').select('route_id').eq('trip_id', parentTripId).single();
        const origRouteId = origTrip?.route_id;

        // 2. Rewrite trip_stops on the original trip ID
        await supabase.from('stop_times').delete().eq('trip_id', parentTripId);
        if (tsRes.data?.length) {
          await supabase.from('stop_times').insert(
            tsRes.data.map((ts: any) => ({ trip_id: parentTripId, stop_id: ts.stop_id, stop_sequence: ts.stop_sequence, timepoint: 0 }))
          );
          // Approve any pending stops
          const stopIds = tsRes.data.map((ts: any) => ts.stop_id);
          await supabase.from('stops').update({ status: 'approved' } as any).in('stop_id', stopIds).eq('status', 'pending');
        }

        // 3. Upsert shape onto original trip ID
        if (shapeRes.data?.geojson) {
          await supabase.from('trip_shapes').upsert(
            { trip_id: parentTripId, geojson: shapeRes.data.geojson as any },
            { onConflict: 'trip_id' }
          );
        }

        // 4. Upsert fare onto original route ID
        if (fareRes.data?.amount != null && origRouteId) {
          await supabase.from('fares').upsert(
            { route_id: origRouteId, amount: fareRes.data.amount, currency: fareRes.data.currency || 'EGP' } as any,
            { onConflict: 'route_id' }
          );
        }

        // 5. Upsert duration onto original trip ID
        // duration not stored separately in new schema

        // 6. Update original trip name + mark reviewed
        await supabase.from('trips').update({
          trip_headsign: trip.name,
          status: 'approved',
          reviewer_id: user?.id ?? null,
          reviewed_at: new Date().toISOString(),
        } as any).eq('trip_id', parentTripId);

        if (origRouteId) {
          await supabase.from('routes').update({
            route_long_name: trip.name
          } as any).eq('route_id', origRouteId);
        }

        // 7. Delete the pending copy
        await supabase.from('stop_times').delete().eq('trip_id', trip.id);
        await supabase.from('trip_shapes').delete().eq('trip_id', trip.id);
        await supabase.from('fares').delete().eq('route_id', (trip as any).route_id);
        await supabase.from('trips').delete().eq('trip_id', trip.id);
        await supabase.from('routes').delete().eq('route_id', (trip as any).route_id);

        // 8. Clean up orphaned stops — pending stops no longer in any trip_stops row
        const { data: allStopTimes } = await supabase.from('stop_times').select('stop_id');
        const referencedIds = new Set((allStopTimes || []).map((st: any) => st.stop_id));
        const { data: pendingStops } = await supabase.from('stops').select('stop_id').eq('status', 'pending');
        const orphanIds = (pendingStops || []).map((s: any) => s.stop_id).filter((id: string) => !referencedIds.has(id));
        if (orphanIds.length > 0) {
          await supabase.from('stops').delete().in('stop_id', orphanIds);
        }

        toast.success(`"${trip.name}" approved — original trip updated in place!`);
      } else {
        // Normal new trip approval — just approve it directly
        const { error: tripError } = await supabase
          .from('trips')
          .update({ status: 'approved', reviewer_id: user?.id ?? null, reviewed_at: new Date().toISOString() } as any)
          .eq('trip_id', trip.id);
        if (tripError) throw tripError;

        // Ensure the parent route is also approved
        if ((trip as any).route_id) {
          await supabase.from('routes').update({ status: 'approved' } as any).eq('route_id', (trip as any).route_id).eq('status', 'pending');
        }

        const { data: ts } = await supabase.from('stop_times').select('stop_id').eq('trip_id', trip.id);
        if (ts) {
          const stopIds = (ts as StopTime[]).map((t) => t.stop_id);
          await supabase.from('stops').update({ status: 'approved' } as any).in('stop_id', stopIds).eq('status', 'pending');
        }

        toast.success(`"${trip.name}" approved and is now live!`);
      }

      onActionComplete();
    } catch (err) {
      console.error('Approve error:', err);
      toast.error('Failed to approve.');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('trips')
        .update({ status: 'rejected', reviewer_id: user?.id ?? null, review_note: rejectNote || null, reviewed_at: new Date().toISOString() })
        .eq('trip_id', trip.id);
      if (error) throw error;

      if ((trip as any).route_id && (trip as any).parent_trip_id) {
        await supabase.from('routes').update({ status: 'rejected' } as any).eq('route_id', (trip as any).route_id);
      }

      toast.success(`"${trip.name}" rejected.`);
      setShowReject(false);
      setRejectNote('');
      onActionComplete();
    } catch (err) {
      console.error('Reject error:', err);
      toast.error('Failed to reject.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setShowEdit(true)} disabled={loading}>
          Edit
        </Button>
        <Button size="lg" className="flex-1 bg-green-600 hover:bg-green-700 text-white" onClick={handleApprove} disabled={loading}>
          Approve
        </Button>
        <Button size="lg" variant="destructive" className="flex-1" onClick={() => setShowReject(true)} disabled={loading}>
          Reject
        </Button>
      </div>

      <SplitEditor
        open={showEdit}
        onOpenChange={setShowEdit}
        trip={trip}
        initialStops={tripStops}
        fare={fare}
        onSave={handleSaveEdits}
      />

      {/* Reject Dialog */}
      <Dialog open={showReject} onOpenChange={setShowReject}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Reject &quot;{trip.name}&quot;</DialogTitle>
            <DialogDescription>Provide a reason for rejection (optional)</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Rejection note..." value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} rows={3} />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowReject(false)}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={handleReject} disabled={loading}>Confirm Reject</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}