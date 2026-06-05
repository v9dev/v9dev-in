import type { Architecture } from '@content/architectures';
import { useEffect, useMemo, useRef, useState } from 'react';
import ServiceNode from './ServiceNode';
import { layout, portAnchor, wirePath } from './board';
import type { PlacedNode } from './board';
import type { Command } from './commands';
import type { DeckAction, DeckState } from './state';

interface Props {
  arch: Architecture;
  state: DeckState;
  dispatch: React.Dispatch<DeckAction>;
  onRun: (cmd: Command) => void;
}

export default function Diagram({ arch, state }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setDims({ width: rect.width, height: rect.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const placed = useMemo(() => layout(arch, state.positions, dims), [arch, state.positions, dims]);

  const placedById = useMemo(() => {
    const map = new Map<string, PlacedNode>();
    for (const p of placed) map.set(p.node.id, p);
    return map;
  }, [placed]);

  const ready = dims.width > 0 && dims.height > 0;

  return (
    <div
      ref={canvasRef}
      data-lenis-prevent
      data-cursor="drag"
      data-cursor-label="wire"
      className="relative h-[clamp(22rem,60vh,40rem)] overflow-hidden rounded-2xl border border-line bg-canvas/60"
    >
      <svg
        className="absolute inset-0 h-full w-full"
        width={dims.width}
        height={dims.height}
        role="img"
        aria-label="architecture wiring"
      >
        <title>architecture wiring</title>
        <defs>
          <linearGradient id="deck-wire" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3AE0FF" stopOpacity="0.85" />
            <stop offset="50%" stopColor="#B8FF3A" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#FF3A8C" stopOpacity="0.85" />
          </linearGradient>
          <filter id="deck-wire-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#B8FF3A" floodOpacity="0.35" />
          </filter>
        </defs>
        {ready &&
          state.edges.map((edge) => {
            const from = placedById.get(edge.from);
            const to = placedById.get(edge.to);
            if (!from || !to) return null;
            const d = wirePath(portAnchor(from, 'out'), portAnchor(to, 'in'));
            return (
              <path
                key={edge.id}
                d={d}
                fill="none"
                stroke="url(#deck-wire)"
                strokeWidth={1.75}
                strokeLinecap="round"
                filter="url(#deck-wire-glow)"
              />
            );
          })}
      </svg>

      {ready && placed.map((p) => <ServiceNode key={p.node.id} node={p.node} x={p.x} y={p.y} />)}
    </div>
  );
}
