'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { PickedStop } from '@/components/Map/StopPicker';

interface StopSequenceListProps {
  stops: PickedStop[];
  onStopsChange: (stops: PickedStop[]) => void;
}

export function StopSequenceList({ stops, onStopsChange }: StopSequenceListProps) {
  const moveStop = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= stops.length) return;
    const newStops = [...stops];
    const [moved] = newStops.splice(fromIdx, 1);
    newStops.splice(toIdx, 0, moved);
    onStopsChange(newStops);
  };

  const removeStop = (idx: number) => {
    onStopsChange(stops.filter((_, i) => i !== idx));
  };

  const updateName = (idx: number, name: string) => {
    const newStops = [...stops];
    newStops[idx] = { ...newStops[idx], name };
    onStopsChange(newStops);
  };

  if (stops.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <div className="text-3xl mb-2">📍</div>
        <p className="text-sm">Click the map to add stops</p>
        <p className="text-xs mt-1">
          Existing stops snap automatically within 30m
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-muted-foreground">
        Stop Sequence ({stops.length})
      </h4>
      {stops.map((stop, idx) => (
        <div
          key={stop.id || `${stop.lat}-${stop.lon}-${idx}`}
          className="flex items-center gap-2 p-2 rounded-lg border border-border/50 bg-card group hover:border-border transition-colors"
        >
          {/* Number badge */}
          <div
            className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{
              background: stop.isExisting ? '#22c55e' : '#f97316',
            }}
          >
            {idx + 1}
          </div>

          {/* Name */}
          <div className="flex-1 min-w-0">
            {stop.isExisting ? (
              <span className="text-sm truncate block">
                {stop.name || 'Unnamed Stop'}
              </span>
            ) : (
              <Input
                value={stop.name ?? ''}
                onChange={(e) => updateName(idx, e.target.value)}
                placeholder="Stop name"
                className="h-7 text-sm border-0 bg-transparent px-0 focus-visible:ring-0"
              />
            )}
            <span className="text-[10px] text-muted-foreground">
              {stop.lat.toFixed(5)}, {stop.lon.toFixed(5)}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => moveStop(idx, idx - 1)}
              disabled={idx === 0}
              className="p-1 hover:bg-accent rounded text-xs disabled:opacity-30"
              title="Move up"
            >
              ↑
            </button>
            <button
              onClick={() => moveStop(idx, idx + 1)}
              disabled={idx === stops.length - 1}
              className="p-1 hover:bg-accent rounded text-xs disabled:opacity-30"
              title="Move down"
            >
              ↓
            </button>
            <button
              onClick={() => removeStop(idx)}
              className="p-1 hover:bg-destructive/10 hover:text-destructive rounded text-xs"
              title="Remove"
            >
              x
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
