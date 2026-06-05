import type { Architecture } from '@content/architectures';
import { prefersReducedMotion } from '@lib/motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ServiceNode from './ServiceNode';
import { canConnect, layout, portAnchor, wirePath } from './board';
import type { PlacedNode } from './board';
import type { Command } from './commands';
import type { DeckAction, DeckState } from './state';

interface Props {
  arch: Architecture;
  state: DeckState;
  dispatch: React.Dispatch<DeckAction>;
  onRun: (cmd: Command) => void;
}

export default function Diagram({ arch, state, dispatch, onRun }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 0, height: 0 });
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(prefersReducedMotion());
  }, []);

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

  const armedFrom = state.armedFrom;

  // The set of valid target node ids while a source is armed (drives the
  // candidate ring/scale affordance on the IN ports).
  const candidates = useMemo(() => {
    if (!armedFrom) return new Set<string>();
    const ids = new Set<string>();
    for (const n of arch.nodes) {
      if (canConnect(arch, armedFrom, n.id).ok) ids.add(n.id);
    }
    return ids;
  }, [arch, armedFrom]);

  const disarm = useCallback(() => {
    if (!state.armedFrom) return;
    dispatch({ type: 'DISARM' });
    dispatch({ type: 'LOG', kind: 'system', text: 'cancelled' });
  }, [dispatch, state.armedFrom]);

  // Activating an OUT port arms this node as the wiring source. Re-activating
  // the already-armed source cancels (DISARM).
  const handlePortOut = useCallback(
    (id: string) => {
      if (state.armedFrom === id) {
        disarm();
        return;
      }
      dispatch({ type: 'ARM', from: id });
      dispatch({
        type: 'LOG',
        kind: 'system',
        text: `armed: ${id} - choose a target (esc to cancel)`,
      });
    },
    [dispatch, disarm, state.armedFrom],
  );

  // Activating an IN port: while armed it completes the wire via the SAME path
  // as a typed `connect` (so validity, LINK/error lines, and history match the
  // terminal). When nothing is armed, activating an in-port that has exactly
  // one inbound edge disconnects that edge.
  const handlePortIn = useCallback(
    (id: string) => {
      if (state.armedFrom) {
        const from = state.armedFrom;
        onRun({
          kind: 'action',
          action: { type: 'CONNECT', from, to: id },
          echo: `connect ${from} ${id}`,
        });
        return;
      }
      const inbound = state.edges.filter((e) => e.to === id);
      if (inbound.length === 1) {
        const edge = inbound[0];
        onRun({
          kind: 'action',
          action: { type: 'DISCONNECT', from: edge.from, to: edge.to },
          echo: `disconnect ${edge.from} ${edge.to}`,
        });
      }
    },
    [onRun, state.armedFrom, state.edges],
  );

  // Clicking empty canvas cancels an armed source.
  const handleCanvasPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) disarm();
    },
    [disarm],
  );

  // Esc cancels an armed source (canvas-scoped keydown listener).
  const handleCanvasKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') disarm();
    },
    [disarm],
  );

  const ready = dims.width > 0 && dims.height > 0;

  return (
    <div
      ref={canvasRef}
      data-lenis-prevent
      data-cursor="drag"
      data-cursor-label="wire"
      onPointerDown={handleCanvasPointerDown}
      onKeyDown={handleCanvasKeyDown}
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

      {ready &&
        placed.map((p) => (
          <ServiceNode
            key={p.node.id}
            node={p.node}
            x={p.x}
            y={p.y}
            armed={armedFrom === p.node.id}
            candidate={candidates.has(p.node.id)}
            wiring={armedFrom != null}
            reducedMotion={reduced}
            onPortOut={handlePortOut}
            onPortIn={handlePortIn}
          />
        ))}
    </div>
  );
}
