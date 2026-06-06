import type { Architecture } from '@content/architectures';
import { durations, prefersReducedMotion } from '@lib/motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ServiceNode from './ServiceNode';
import Tray from './Tray';
import { judgeWire, layout, onlineNodes, portAnchor, wirePath } from './board';
import type { PlacedNode } from './board';
import type { Command, Ctx } from './commands';
import type { DeckAction, DeckState, Pos } from './state';

interface Props {
  arch: Architecture;
  state: DeckState;
  ctx: Ctx;
  dispatch: React.Dispatch<DeckAction>;
  onRun: (cmd: Command) => void;
  /** Whether the whole deck is in fullscreen (drives the control glyph). */
  fullscreen: boolean;
  /** Toggle whole-deck fullscreen (the control lives on the board). */
  onToggleFullscreen: () => void;
}

// Pointer must move this many px before a node-body press becomes a reposition
// drag (so a plain click still selects/opens detail rather than nudging).
const DRAG_THRESHOLD = 4;
// Snap radius (screen px) around an in-port that counts as a drag-to-wire target.
const SNAP_RADIUS = 48;
// Zoom bounds for the board view.
const SCALE_MIN = 0.4;
const SCALE_MAX = 2.5;

// Board view transform: pan offset (x, y, screen px) + zoom (scale). Scene (node
// layout) coordinates map to screen via scene*scale + offset (origin top-left).
interface View {
  scale: number;
  x: number;
  y: number;
}
const DEFAULT_VIEW: View = { scale: 1, x: 0, y: 0 };
const clampScale = (s: number): number => Math.min(SCALE_MAX, Math.max(SCALE_MIN, s));

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
    }
  | {
      kind: 'pan';
      pointerId: number;
      startX: number;
      startY: number;
      originX: number;
      originY: number;
    };

export default function Diagram({
  arch,
  state,
  ctx,
  dispatch,
  onRun,
  fullscreen,
  onToggleFullscreen,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<SVGPathElement>(null);
  const [dims, setDims] = useState({ width: 0, height: 0 });
  const [reduced, setReduced] = useState(false);

  // Pan/zoom view. Mirrored into a ref so the pointer handlers read the live
  // transform without stale closures (and pan can mutate it imperatively).
  const [view, setView] = useState<View>(DEFAULT_VIEW);
  const viewRef = useRef(view);
  viewRef.current = view;

  // On-board tray (collapsible). Open by default so cards are reachable on the
  // canvas where the player is working.
  const [trayOpen, setTrayOpen] = useState(true);

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

  // Reset the view when the scenario changes so each level starts framed.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only on slug change.
  useEffect(() => {
    viewRef.current = DEFAULT_VIEW;
    setView(DEFAULT_VIEW);
  }, [arch.slug]);

  // Only PLACED cards render on the board; the tray holds the rest. Filter the
  // arch nodes to the placed set before layout so the diagram builds up as the
  // player adds cards. (`placed` below is PlacedNode[]; do not confuse it with
  // `state.placed`, the placed-card id list.)
  const liveArch = useMemo(
    () => ({ ...arch, nodes: arch.nodes.filter((n) => state.placed.includes(n.id)) }),
    [arch, state.placed],
  );
  const placed = useMemo(
    () => layout(liveArch, state.positions, dims),
    [liveArch, state.positions, dims],
  );

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

  // Online/offline set: a node lights up once all of its required inbound edges
  // are wired (sources are online from the start). Only live while the scenario
  // is playing - at the menu every node reads offline (empty set). Pure derive.
  const online = useMemo(
    () =>
      state.phase === 'playing' ? onlineNodes(arch, state.edges, state.placed) : new Set<string>(),
    [arch, state.edges, state.phase, state.placed],
  );

  // ── Coordinate transforms ─────────────────────────────────────────────────
  // pointerRef and toLocal work in CANVAS (screen) px relative to the canvas box.
  // Scene = node layout space; the transform wrapper maps scene -> canvas via
  // scene*scale + offset. Drag math converts between the two through these.
  const toLocal = useCallback((clientX: number, clientY: number): Pos => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) };
  }, []);
  const canvasToScene = useCallback((p: Pos): Pos => {
    const v = viewRef.current;
    return { x: (p.x - v.x) / v.scale, y: (p.y - v.y) / v.scale };
  }, []);
  const sceneToCanvas = useCallback((p: Pos): Pos => {
    const v = viewRef.current;
    return { x: p.x * v.scale + v.x, y: p.y * v.scale + v.y };
  }, []);
  // Imperatively apply a view to the wrapper (used during pan to avoid a React
  // re-render of every node on each frame).
  const applyTransform = useCallback((v: View) => {
    if (wrapperRef.current) {
      wrapperRef.current.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.scale})`;
    }
  }, []);

  // ── Drag session (local, dispatch only on pointerup) ──────────────────────
  const dragRef = useRef<DragSession | null>(null);
  const pointerRef = useRef<Pos>({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const placedRef = useRef<Map<string, PlacedNode>>(placedById);
  placedRef.current = placedById;

  const [wireDragging, setWireDragging] = useState(false);
  const [snapTargetId, setSnapTargetId] = useState<string | null>(null);
  const snapTargetRef = useRef<string | null>(null);

  // A rejected wire drop briefly flashes the target card fuchsia (no edge is
  // ever created). Transient local state, cleared after one pulse.
  const [rejectId, setRejectId] = useState<string | null>(null);
  const rejectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Nearest in-port to a canvas point, within SNAP_RADIUS (compared in screen px
  // so the snap feels the same at any zoom). Every placed node is a legal target
  // now - the wire is judged on drop (judgeWire), not gated here.
  const nearestTarget = useCallback(
    (sourceId: string, pointCanvas: Pos): string | null => {
      let best: string | null = null;
      let bestDist = SNAP_RADIUS;
      for (const p of placedRef.current.values()) {
        if (p.node.id === sourceId) continue;
        const anchor = sceneToCanvas(portAnchor(p, 'in'));
        const dist = Math.hypot(anchor.x - pointCanvas.x, anchor.y - pointCanvas.y);
        if (dist < bestDist) {
          bestDist = dist;
          best = p.node.id;
        }
      }
      return best;
    },
    [sceneToCanvas],
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

    if (session.kind === 'pan') {
      // Imperative pan: shift the view offset by the canvas-px delta. No setState
      // here so the nodes do not re-render every frame; state is committed on up.
      const v: View = {
        scale: viewRef.current.scale,
        x: session.originX + (point.x - session.startX),
        y: session.originY + (point.y - session.startY),
      };
      viewRef.current = v;
      applyTransform(v);
    } else if (session.kind === 'wire') {
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
        // Ghost lives inside the transformed wrapper, so both ends are SCENE
        // coords: the snapped in-port anchor, or the live pointer mapped back.
        const end = snapped ? portAnchor(snapped, 'in') : canvasToScene(point);
        ghostRef.current?.setAttribute('d', wirePath(portAnchor(source, 'out'), end));
      }
    } else {
      // Node reposition: the card lives in the scaled wrapper, so the inline
      // translate is in SCENE units (canvas delta / scale) - it then renders back
      // to the canvas-px the pointer moved.
      const s = viewRef.current.scale;
      const dx = point.x - session.startX;
      const dy = point.y - session.startY;
      if (!session.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) session.moved = true;
      const card = canvasRef.current?.querySelector<HTMLElement>(
        `[data-node-id="${session.nodeId}"]`,
      );
      if (card) {
        card.style.transform = `translate(-50%, -50%) translate(${dx / s}px, ${dy / s}px)`;
      }
    }

    rafRef.current = requestAnimationFrame(frame);
  }, [applyTransform, canvasToScene, nearestTarget]);

  const endDrag = useCallback(
    (clientX: number, clientY: number, cancelled = false) => {
      const session = dragRef.current;
      dragRef.current = null;
      stopRaf();
      if (!session) return;
      const point = toLocal(clientX, clientY);
      const couldTrailClick = !cancelled;

      if (session.kind === 'pan') {
        // Commit the imperative pan into state so the rendered transform matches.
        setView(viewRef.current);
        return;
      }

      if (session.kind === 'wire') {
        const target = nearestTarget(session.nodeId, point);
        setWireDragging(false);
        setSnapTargetId(null);
        snapTargetRef.current = null;
        if (couldTrailClick && (session.moved || target)) suppressClickRef.current = true;
        if (target) {
          // Flash the target red when the drop is a rejected wire. The runner
          // still judges + logs the reason/penalty below; this is the UI tell.
          const verdict = judgeWire(arch, state.placed, session.nodeId, target);
          if (!verdict.ok) {
            setRejectId(target);
            if (rejectTimerRef.current) clearTimeout(rejectTimerRef.current);
            rejectTimerRef.current = setTimeout(() => setRejectId(null), durations.pulse * 1000);
          }
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
        if (card) card.style.transform = '';
        if (session.moved) {
          if (couldTrailClick) suppressClickRef.current = true;
          // Convert the canvas-px drag delta back to scene units before storing.
          const s = viewRef.current.scale;
          const dx = (point.x - session.startX) / s;
          const dy = (point.y - session.startY) / s;
          dispatch({
            type: 'MOVE_NODE',
            id: session.nodeId,
            pos: { x: session.originX + dx, y: session.originY + dy },
          });
        }
      }
    },
    [arch, dispatch, nearestTarget, onRun, state.placed, stopRaf, toLocal],
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

  const consumeClickSuppressed = useCallback(() => {
    if (!suppressClickRef.current) return false;
    suppressClickRef.current = false;
    return true;
  }, []);

  // Cancel any in-flight rAF on unmount.
  useEffect(() => stopRaf, [stopRaf]);

  // Clear a pending reject-flash timer on unmount.
  useEffect(
    () => () => {
      if (rejectTimerRef.current) clearTimeout(rejectTimerRef.current);
    },
    [],
  );

  // ── Zoom ──────────────────────────────────────────────────────────────────
  // Wheel-to-zoom toward the cursor, via a non-passive native listener so it can
  // preventDefault the page scroll (the canvas is not itself scrollable).
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const v = viewRef.current;
      const scale = clampScale(v.scale * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
      const next: View = {
        scale,
        x: cx - ((cx - v.x) / v.scale) * scale,
        y: cy - ((cy - v.y) / v.scale) * scale,
      };
      viewRef.current = next;
      setView(next);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Zoom by a factor around the canvas centre (the +/- buttons).
  const zoomBy = useCallback((factor: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const cx = (rect?.width ?? 0) / 2;
    const cy = (rect?.height ?? 0) / 2;
    const v = viewRef.current;
    const scale = clampScale(v.scale * factor);
    const next: View = {
      scale,
      x: cx - ((cx - v.x) / v.scale) * scale,
      y: cy - ((cy - v.y) / v.scale) * scale,
    };
    viewRef.current = next;
    setView(next);
  }, []);

  const resetView = useCallback(() => {
    viewRef.current = DEFAULT_VIEW;
    setView(DEFAULT_VIEW);
  }, []);

  const disarm = useCallback(() => {
    if (!state.armedFrom) return;
    dispatch({ type: 'DISARM' });
    dispatch({ type: 'LOG', kind: 'system', text: 'cancelled' });
  }, [dispatch, state.armedFrom]);

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

  // Pressing the empty canvas starts a PAN (and cancels any armed source / clears
  // stale post-drag click suppression). Presses on a node/port hit their own
  // handlers first and bubble here with e.target !== the canvas, so they never
  // start a pan.
  const handleCanvasPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      suppressClickRef.current = false;
      if (e.target !== e.currentTarget) return;
      disarm();
      canvasRef.current?.setPointerCapture(e.pointerId);
      const start = toLocal(e.clientX, e.clientY);
      dragRef.current = {
        kind: 'pan',
        pointerId: e.pointerId,
        startX: start.x,
        startY: start.y,
        originX: viewRef.current.x,
        originY: viewRef.current.y,
      };
      pointerRef.current = start;
      stopRaf();
      rafRef.current = requestAnimationFrame(frame);
    },
    [disarm, frame, stopRaf, toLocal],
  );

  const handleCanvasKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') disarm();
    },
    [disarm],
  );

  const handleSelect = useCallback(
    (id: string) => {
      dispatch({ type: 'SELECT_NODE', id });
    },
    [dispatch],
  );

  // The card's x control returns it to the tray via the SAME path as a typed
  // `remove`, so the log line, move count, and dropped wires all match.
  const handleRemove = useCallback(
    (id: string) => {
      onRun({ kind: 'game', verb: 'remove', arg: id, echo: `remove ${id}` });
    },
    [onRun],
  );

  const ready = dims.width > 0 && dims.height > 0;
  const ctrlClass =
    'grid size-7 place-items-center rounded-md border border-line bg-canvas/80 font-mono text-[12px] text-muted backdrop-blur-sm transition-colors hover:border-lime hover:text-lime focus:outline-none focus-visible:ring-2 focus-visible:ring-lime';

  return (
    <div
      ref={canvasRef}
      data-lenis-prevent
      data-cursor="drag"
      data-cursor-label="pan"
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onKeyDown={handleCanvasKeyDown}
      className="relative h-[var(--deck-panel-h,clamp(22rem,60vh,40rem))] touch-none overflow-hidden rounded-2xl border border-line bg-canvas/60"
    >
      {/* Pan/zoom wrapper - every scene element (edges + nodes) lives inside so
          they transform together; overlays (controls, tray) sit outside it. */}
      <div
        ref={wrapperRef}
        className="absolute inset-0 origin-top-left"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
      >
        <svg
          className="absolute inset-0 h-full w-full"
          style={{ overflow: 'visible' }}
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
              candidate={false}
              wiring={armedFrom != null}
              snapTarget={snapTargetId === p.node.id}
              online={online.has(p.node.id)}
              bootUp={bootUp.has(p.node.id)}
              bootUnreachable={bootUnreachable.has(p.node.id)}
              reject={rejectId === p.node.id}
              reducedMotion={reduced}
              onPortOut={handlePortOut}
              onPortIn={handlePortIn}
              onSelect={handleSelect}
              onWireStart={handleWireStart}
              onNodeDragStart={handleNodeDragStart}
              onRemove={handleRemove}
              consumeClickSuppressed={consumeClickSuppressed}
            />
          ))}
      </div>

      {/* Board controls (zoom / fit / fullscreen / tray) - fixed on the viewport,
          outside the pan/zoom wrapper so they never move or scale. */}
      <div className="absolute right-2 top-2 z-20 flex flex-col gap-1.5">
        <button
          type="button"
          aria-label="zoom in"
          className={ctrlClass}
          onClick={() => zoomBy(1.2)}
        >
          +
        </button>
        <button
          type="button"
          aria-label="zoom out"
          className={ctrlClass}
          onClick={() => zoomBy(1 / 1.2)}
        >
          {'−'}
        </button>
        <button
          type="button"
          aria-label="reset view"
          className={ctrlClass}
          onClick={resetView}
          data-cursor-label="fit"
        >
          {'⤢'}
        </button>
        <button
          type="button"
          aria-label={fullscreen ? 'exit fullscreen' : 'fullscreen'}
          className={ctrlClass}
          onClick={onToggleFullscreen}
          data-cursor-label={fullscreen ? 'exit' : 'full'}
        >
          {fullscreen ? '×' : '⛶'}
        </button>
        <button
          type="button"
          aria-label={trayOpen ? 'hide tray' : 'show tray'}
          className={ctrlClass}
          onClick={() => setTrayOpen((o) => !o)}
          data-cursor-label="tray"
        >
          {'▤'}
        </button>
      </div>

      {/* Current zoom level, top-left (clear of the controls and the tray). */}
      <div className="absolute left-2 top-2 z-20 rounded-md border border-line bg-canvas/80 px-2 py-0.5 font-mono text-[10px] text-muted backdrop-blur-sm">
        {Math.round(view.scale * 100)}%
      </div>

      {/* On-board tray (collapsible) - a floating strip of add-a-card chips docked
          at the bottom edge of the board, where the player is working. */}
      {trayOpen && (
        <div className="absolute inset-x-2 bottom-2 z-20">
          <Tray arch={arch} state={state} ctx={ctx} onRun={onRun} />
        </div>
      )}
    </div>
  );
}
