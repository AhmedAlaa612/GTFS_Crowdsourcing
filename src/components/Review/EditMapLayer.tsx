'use client';

import { useMemo, useEffect, useState } from 'react';
import { CircleMarker, Marker, Polyline, Tooltip } from 'react-leaflet';
import type { MappedStop } from '@/components/Map/StopPicker';

interface EditMapLayerProps {
  routeStops: MappedStop[];
  availableStops: MappedStop[];
  highlightedIdx: number | null;
  onStopClick: (stop: MappedStop) => void;
  onStopHover: (idx: number | null) => void;
}

export function EditMapLayer({
  routeStops,
  availableStops,
  highlightedIdx,
  onStopClick,
  onStopHover,
}: EditMapLayerProps) {
  const [icons, setIcons] = useState<any[]>([]);

  // Build DivIcons for sequence numbers — rebuild when stops or highlight changes
  useEffect(() => {
    import('leaflet').then((L) => {
      const built = routeStops.map((stop, idx) => {
        const isHighlighted = highlightedIdx === idx;
        const isNew = stop.id.startsWith('new-');
        const bg = isHighlighted ? '#f59e0b' : isNew ? '#f97316' : '#3b82f6';
        const size = isHighlighted ? 28 : 24;
        return L.default.divIcon({
          className: '',
          html: `<div style="
            width:${size}px;height:${size}px;
            background:${bg};
            border:2.5px solid white;
            border-radius:50%;
            display:flex;align-items:center;justify-content:center;
            font-size:${isHighlighted ? 12 : 10}px;
            font-weight:800;color:white;
            box-shadow:0 2px 6px rgba(0,0,0,0.4);
            pointer-events:none;
          ">${idx + 1}</div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
      });
      setIcons(built);
    });
  }, [routeStops, highlightedIdx]);

  const routeLine = useMemo(
    () => routeStops.map((s) => [s.lat, s.lon] as [number, number]),
    [routeStops]
  );

  return (
    <>
      {/* Route polyline */}
      {routeLine.length > 1 && (
        <Polyline
          positions={routeLine}
          pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.85, dashArray: '8 6' }}
        />
      )}

      {/* Available stops — green, clickable */}
      {availableStops.map((stop) => (
        <CircleMarker
          key={stop.id}
          center={[stop.lat, stop.lon]}
          radius={7}
          pathOptions={{
            color: 'white', fillColor: '#22c55e',
            fillOpacity: 0.9, weight: 2,
          }}
          eventHandlers={{
            click: async (e) => {
              const L = (await import('leaflet')).default;
              L.DomEvent.stopPropagation(e as any);
              onStopClick(stop);
            },
          }}
        >
          <Tooltip sticky>
            <span style={{ fontWeight: 600 }}>{stop.name || 'Unnamed stop'}</span><br />
            <span style={{ fontSize: 11, opacity: 0.7 }}>Click to add to route</span>
          </Tooltip>
        </CircleMarker>
      ))}

      {/* Invisible hit-area CircleMarkers for hover + tooltip on route stops */}
      {routeStops.map((stop, idx) => {
        const isHighlighted = highlightedIdx === idx;
        return (
          <CircleMarker
            key={stop.id + '-hit-' + idx}
            center={[stop.lat, stop.lon]}
            radius={isHighlighted ? 16 : 13}
            pathOptions={{
              color: 'transparent', fillColor: 'transparent',
              fillOpacity: 0, weight: 0,
            }}
            eventHandlers={{
              mouseover: () => onStopHover(idx),
              mouseout: () => onStopHover(null),
            }}
          >
            <Tooltip sticky offset={[12, 0]}>
              <span style={{ fontWeight: 600 }}>{stop.name || `Stop ${idx + 1}`}</span><br />
              <span style={{ fontSize: 11, opacity: 0.7 }}>
                #{idx + 1}{stop.id.startsWith('new-') ? ' · new' : ''}
              </span>
            </Tooltip>
          </CircleMarker>
        );
      })}

      {/* Numbered DivIcon markers — pointer-events:none so they never block hover */}
      {icons.length === routeStops.length && routeStops.map((stop, idx) => (
        <Marker
          key={stop.id + '-icon-' + idx}
          position={[stop.lat, stop.lon]}
          icon={icons[idx]}
          interactive={false}
        />
      ))}
    </>
  );
}