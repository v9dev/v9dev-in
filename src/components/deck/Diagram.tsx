import type { Architecture } from '@content/architectures';
import { prefersReducedMotion } from '@lib/motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ServiceNode from './ServiceNode';
import { canConnect, layout, portAnchor, wirePath } from './board';
import type { PlacedNode } from './board';
import type { Command } from './commands';
import type { DeckAction, DeckState, Pos } from './state';

interface Props {
  arch: Architecture;
  state: DeckState;
  dispatch: React.Dispatch<DeckAction>;
  onRun: (cmd: Command) => void;
}

// Pointer must move this many px before a node-body press becomes a reposition
// drag (so a plain click still selects/opens detail rather than nudging).
const DRAG_THRESHOLD = 4;
// Snap radius (px) around an in-port that counts as a drag-to-wire target.
const SNAP_RADIUS = 48;

type DragSession =
  | {
      kind: 'wire';
      nodeId: string;
      pointerId: number;
      startX: number;
      startY: number;
      moved: boolean;
    }
  | {
      kind: 'node';
      nodeId: string;
      pointerId: number;
      startX: number;
      startY: number;
      originX: number;
      originY: number;
      moved: boolean;
    };

export default function Diagram({ arch, state, dispatch, onRun }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<SVGPathElement>(null);
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

  // Boot status sets, derived from the reducer. Membership drives the green
  // "up" pulse and the red "unreachable" outline on each ServiceNode.
  const bootUp = useMemo(() => new Set(state.boot.up), [state.boot.up]);
  const bootUnreachable = useMemo(() => new Set(state.boot.unreachable), [state.boot.unreachable]);

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

  // ── Drag session (local, dispatch only on pointerup) ──────────────────────
  // All per-frame work happens inside an rAF loop that runs ONLY while a drag is
  // active; nothing here dispatches to the reducer until pointerup. Live pointer
  // position lives in a ref so pointermove never re-renders the diagram.
  const dragRef = useRef<DragSession | null>(null);
  const pointerRef = useRef<Pos>({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  // Set on pointerup when a node drag actually moved or a wire session ran, so
  // the trailing synthesized click on the same button is swallowed instead of
  // running the click-driven onSelect / arm path. Cleared on the next pointerdown
  // and when the click consumes it.
  const suppressClickRef = useRef(false);
  const placedRef = useRef<Map<string, PlacedNode>>(placedById);
  placedRef.current = placedById;

  // `wireDragging` toggles the ghost <path>; `snapTargetId` highlights the
  // nearest valid in-port. Both update at most when their value changes (not
  // per frame), so the rest of the diagram stays still during a drag.
  const [wireDragging, setWireDragging] = useState(false);
  const [snapTargetId, setSnapTargetId] = useState<string | null>(null);
  const snapTargetRef = useRef<string | null>(null);

  const toLocal = useCallback((clientX: number, clientY: number): Pos => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) };
  }, []);

  // Nearest valid in-port to a local point, within SNAP_RADIUS, given the armed
  // source. Returns null when nothing is close enough or valid.
  const nearestTarget = useCallback(
    (sourceId: string, point: Pos): string | null => {
      let best: string | null = null;
      let bestDist = SNAP_RADIUS;
      for (const p of placedRef.current.values()) {
        if (p.node.id === sourceId) continue;
        if (!canConnect(arch, sourceId, p.node.id).ok) continue;
        const anchor = portAnchor(p, 'in');
        const dist = Math.hypot(anchor.x - point.x, anchor.y - point.y);
        if (dist < bestDist) {
          bestDist = dist;
          best = p.node.id;
        }
      }
      return best;
    },
    [arch],
  );

  const stopRaf = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // The single drag frame loop. Re-arms itself while a session is live.
  const frame = useCallback(() => {
    const session = dragRef.current;
    if (!session) {
      rafRef.current = null;
      return;
    }
    const point = pointerRef.current;

    if (session.kind === 'wire') {
      const source = placedRef.current.get(session.nodeId);
      if (source) {
        if (
          !session.moved &&
          Math.hypot(point.x - session.startX, point.y - session.startY) > DRAG_THRESHOLD
        ) {
          session.moved = true;
        }
        const target = nearestTarget(session.nodeId, point);
        if (target !== snapTargetRef.current) {
          snapTargetRef.current = target;
          setSnapTargetId(target);
        }
        const snapped = target ? placedRef.current.get(target) : undefined;
        const end = snapped ? portAnchor(snapped, 'in') : point;
        ghostRef.current?.setAttribute('d', wirePath(portAnchor(source, 'out'), end));
      }
    } else {
      // Node reposition: write the transform offset straight to the card so the
      // React tree does not re-render per frame.
      const dx = point.x - session.startX;
      const dy = point.y - session.startY;
      if (!session.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) session.moved = true;
      const card = canvasRef.current?.querySelector<HTMLElement>(
        `[data-node-id="${session.nodeId}"]`,
      );
      if (card) card.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px)`;
    }

    rafRef.current = requestAnimationFrame(frame);
  }, [nearestTarget]);

  const endDrag = useCallback(
    (clientX: number, clientY: number, cancelled = false) => {
      const session = dragRef.current;
      dragRef.current = null;
      stopRaf();
      if (!session) return;
      const point = toLocal(clientX, clientY);
      // pointercancel produces no trailing click, so never arm the suppression
      // there (it would otherwise wrongly swallow a later keyboard activation).
      const couldTrailClick = !cancelled;

      if (session.kind === 'wire') {
        const target = nearestTarget(session.nodeId, point);
        setWireDragging(false);
        setSnapTargetId(null);
        snapTargetRef.current = null;
        // Swallow the trailing click only when this was a real drag (moved past
        // the threshold) or it landed on a target - so it does not also run the
        // click-driven arm path. A plain tap with no movement falls through to
        // the D1 onClick arm (keeps tap-to-arm working on touch / mouse).
        if (couldTrailClick && (session.moved || target)) suppressClickRef.current = true;
        if (target) {
          // Same path as a typed `connect` so validity, the LINK/error lines,
          // and history all match the terminal exactly.
          onRun({
            kind: 'action',
            action: { type: 'CONNECT', from: session.nodeId, to: target },
            echo: `connect ${session.nodeId} ${target}`,
          });
        }
      } else {
        const card = canvasRef.current?.querySelector<HTMLElement>(
          `[data-node-id="${session.nodeId}"]`,
        );
        // Drop the inline transform; the reducer's new left/top takes over.
        if (card) card.style.transform = '';
        if (session.moved) {
          // Swallow the trailing click so a reposition does not also fire
          // onSelect (which would open the detail drawer on drop).
          if (couldTrailClick) suppressClickRef.current = true;
          const dx = point.x - session.startX;
          const dy = point.y - session.startY;
          dispatch({
            type: 'MOVE_NODE',
            id: session.nodeId,
            pos: { x: session.originX + dx, y: session.originY + dy },
          });
        }
      }
    },
    [dispatch, nearestTarget, onRun, stopRaf, toLocal],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current || e.pointerId !== dragRef.current.pointerId) return;
      pointerRef.current = toLocal(e.clientX, e.clientY);
    },
    [toLocal],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current || e.pointerId !== dragRef.current.pointerId) return;
      endDrag(e.clientX, e.clientY);
    },
    [endDrag],
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current || e.pointerId !== dragRef.current.pointerId) return;
      endDrag(e.clientX, e.clientY, true);
    },
    [endDrag],
  );

  // Begin a drag-to-wire session from an out port (pointer capture on the
  // canvas so move/up keep flowing even off the small port hit target).
  const handleWireStart = useCallback(
    (id: string, e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      canvasRef.current?.setPointerCapture(e.pointerId);
      const start = toLocal(e.clientX, e.clientY);
      dragRef.current = {
        kind: 'wire',
        nodeId: id,
        pointerId: e.pointerId,
        startX: start.x,
        startY: start.y,
        moved: false,
      };
      pointerRef.current = start;
      snapTargetRef.current = null;
      setSnapTargetId(null);
      setWireDragging(true);
      stopRaf();
      rafRef.current = requestAnimationFrame(frame);
    },
    [frame, stopRaf, toLocal],
  );

  // Begin a node reposition drag from the card body. A plain click (no movement
  // past DRAG_THRESHOLD) leaves selection/onSelect untouched.
  const handleNodeDragStart = useCallback(
    (id: string, e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const source = placedRef.current.get(id);
      if (!source) return;
      canvasRef.current?.setPointerCapture(e.pointerId);
      const start = toLocal(e.clientX, e.clientY);
      dragRef.current = {
        kind: 'node',
        nodeId: id,
        pointerId: e.pointerId,
        startX: start.x,
        startY: start.y,
        originX: source.x,
        originY: source.y,
        moved: false,
      };
      pointerRef.current = start;
      stopRaf();
      rafRef.current = requestAnimationFrame(frame);
    },
    [frame, stopRaf, toLocal],
  );

  // Read-and-clear the post-drag click suppression. Called from the card / out
  // port onClick so the trailing synthesized click after a drag is swallowed
  // once, and the next genuine click goes through.
  const consumeClickSuppressed = useCallback(() => {
    if (!suppressClickRef.current) return false;
    suppressClickRef.current = false;
    return true;
  }, []);

  // Cancel any in-flight rAF on unmount.
  useEffect(() => stopRaf, [stopRaf]);

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

  // Clicking empty canvas cancels an armed source. This also fires (via bubbling)
  // for every pointerdown inside the canvas, so it is where we clear any stale
  // post-drag click-suppression: a new gesture always starts un-suppressed, and
  // the flag only survives between a drag's pointerup and its trailing click.
  const handleCanvasPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      suppressClickRef.current = false;
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

  // Clicking (or Enter/Space on) a node body opens its detail drawer. The
  // click-vs-drag threshold is handled upstream: a reposition that moved past
  // DRAG_THRESHOLD arms suppressClickRef, so ServiceNode swallows the trailing
  // synthesized click before this runs (a plain click still selects).
  const handleSelect = useCallback(
    (id: string) => {
      dispatch({ type: 'SELECT_NODE', id });
    },
    [dispatch],
  );

  const ready = dims.width > 0 && dims.height > 0;

  return (
    <div
      ref={canvasRef}
      data-lenis-prevent
      data-cursor="drag"
      data-cursor-label="wire"
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onKeyDown={handleCanvasKeyDown}
      className="relative h-[clamp(22rem,60vh,40rem)] touch-none overflow-hidden rounded-2xl border border-line bg-canvas/60"
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
            <stop offset="0%" stopColor="var(--color-cyan)" stopOpacity="0.85" />
            <stop offset="50%" stopColor="var(--color-lime)" stopOpacity="0.85" />
            <stop offset="100%" stopColor="var(--color-fuchsia)" stopOpacity="0.85" />
          </linearGradient>
          <filter id="deck-wire-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow
              dx="0"
              dy="0"
              stdDeviation="3"
              floodColor="var(--color-lime)"
              floodOpacity="0.35"
            />
          </filter>
        </defs>
        {ready &&
          state.edges.map((edge) => {
            const from = placedById.get(edge.from);
            const to = placedById.get(edge.to);
            if (!from || !to) return null;
            const d = wirePath(portAnchor(from, 'out'), portAnchor(to, 'in'));
            return (
              <g key={edge.id}>
                <path
                  d={d}
                  fill="none"
                  stroke="url(#deck-wire)"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  filter="url(#deck-wire-glow)"
                />
                {/* Live data-flow: a dashed overlay drifting along the wire. The
                    .wire-flow keyframe is neutralized under prefers-reduced-motion
                    by the global CSS rule, leaving a static dashed stroke. */}
                <path
                  className="wire-flow"
                  d={d}
                  fill="none"
                  stroke="var(--color-lime)"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  opacity={0.45}
                />
              </g>
            );
          })}
        {/* Drag-to-wire ghost path: a single element, mutated directly each
            frame via ghostRef (never re-rendered while dragging). */}
        {wireDragging && (
          <path
            ref={ghostRef}
            d=""
            fill="none"
            stroke="var(--color-lime)"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeDasharray="4 4"
            opacity={0.85}
          />
        )}
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
            snapTarget={snapTargetId === p.node.id}
            bootUp={bootUp.has(p.node.id)}
            bootUnreachable={bootUnreachable.has(p.node.id)}
            reducedMotion={reduced}
            onPortOut={handlePortOut}
            onPortIn={handlePortIn}
            onSelect={handleSelect}
            onWireStart={handleWireStart}
            onNodeDragStart={handleNodeDragStart}
            consumeClickSuppressed={consumeClickSuppressed}
          />
        ))}
    </div>
  );
}
