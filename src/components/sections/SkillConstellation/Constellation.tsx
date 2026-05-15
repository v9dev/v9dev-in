import { getIconPath } from '@lib/icons';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { depthFactor, highlightDash, normalizePointer } from './interaction';
import { type ConstellationGeometry, type NodePosition, buildConstellation } from './path';

const ROW_HEIGHT_DESKTOP = 180;
const ROW_HEIGHT_MOBILE = 150;
const PAD_X_DESKTOP = 80;
const PAD_X_MOBILE = 16;
const PAD_Y = 70;
const NODE_SIZE_DESKTOP = 56;
const NODE_SIZE_MOBILE = 36;
const PARALLAX_MAX_PX = 14; // shift of the nearest depth layer
const TILT_MAX_DEG = 12; // max 3D lean of a hovered node
const MAGNET_MAX_PX = 8; // max drift of a hovered node toward the cursor
const HIGHLIGHT_WINDOW_PX = 120; // path length lit around the hovered node
const PATH_DEPTH = 0.66; // mid depth layer the path rides on

export default function Constellation() {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const [geo, setGeo] = useState<ConstellationGeometry | null>(null);
  const [progress, setProgress] = useState(0);
  const [nodeSize, setNodeSize] = useState(NODE_SIZE_DESKTOP);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [motionEnabled, setMotionEnabled] = useState(true);
  const pointerRaf = useRef(0);

  // ── Respect prefers-reduced-motion for pointer-driven motion ──
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setMotionEnabled(!mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const handleHoverChange = useCallback((id: string, hovered: boolean) => {
    setHoveredId((cur) => (hovered ? id : cur === id ? null : cur));
  }, []);

  const handleSectionPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!motionEnabled) return;
      const el = containerRef.current;
      if (!el || pointerRaf.current) return;
      const { clientX, clientY } = e;
      const rect = el.getBoundingClientRect();
      pointerRaf.current = requestAnimationFrame(() => {
        pointerRaf.current = 0;
        setPointer(normalizePointer(clientX, clientY, rect));
      });
    },
    [motionEnabled],
  );

  const handleSectionPointerLeave = useCallback(() => {
    if (pointerRaf.current) {
      cancelAnimationFrame(pointerRaf.current);
      pointerRaf.current = 0;
    }
    setPointer({ x: 0, y: 0 });
  }, []);

  // Cancel any in-flight pointer frame on unmount.
  useEffect(
    () => () => {
      if (pointerRaf.current) cancelAnimationFrame(pointerRaf.current);
    },
    [],
  );

  // ── Compute geometry from container width ────────────────────
  useLayoutEffect(() => {
    const compute = () => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const width = Math.max(rect.width, 320);
      const mobile = width < 768;
      setNodeSize(mobile ? NODE_SIZE_MOBILE : NODE_SIZE_DESKTOP);
      const g = buildConstellation({
        width,
        rowHeight: mobile ? ROW_HEIGHT_MOBILE : ROW_HEIGHT_DESKTOP,
        padX: mobile ? PAD_X_MOBILE : PAD_X_DESKTOP,
        padY: PAD_Y,
      });
      setGeo(g);
    };

    compute();
    const ro = new ResizeObserver(compute);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // ── Drive draw progress from section scroll ──────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !geo || geo.nodes.length === 0) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setProgress(1);
      return;
    }

    const firstY = geo.nodes[0].y;
    const lastY = geo.nodes[geo.nodes.length - 1].y;

    let raf = 0;
    const tick = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // Anchor the draw to the node positions, not the section box, so a
      // tall (wrapped) constellation still finishes while the last row is
      // on screen instead of after it has scrolled away.
      // progress 0 → first node enters at 85% of the viewport.
      // progress 1 → last node reaches 45% of the viewport (clearly visible).
      const startTop = vh * 0.85 - firstY;
      const endTop = vh * 0.45 - lastY;
      const raw = (startTop - rect.top) / (startTop - endTop);
      const clamped = Math.max(0, Math.min(1, raw));
      setProgress(clamped);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [geo]);

  // ── Measure real path length once mounted ────────────────────
  const realLength = useMemo(() => {
    if (!pathRef.current) return geo?.pathLength ?? 0;
    try {
      return pathRef.current.getTotalLength();
    } catch {
      return geo?.pathLength ?? 0;
    }
  }, [geo]);

  // ── Card-on-path position + active skill ─────────────────────
  const card = useMemo(() => {
    if (!geo || !pathRef.current || realLength === 0) return null;
    const pathEl = pathRef.current;
    try {
      const len = realLength * progress;
      const p = pathEl.getPointAtLength(len);
      // tangent angle via a tiny lookahead
      const ahead = pathEl.getPointAtLength(Math.min(realLength, len + 1));
      const angle = (Math.atan2(ahead.y - p.y, ahead.x - p.x) * 180) / Math.PI;
      // Find currently-active skill: largest pathFraction ≤ progress
      let active: NodePosition | null = null;
      for (const n of geo.nodes) {
        if (n.pathFraction <= progress) active = n;
      }
      return { x: p.x, y: p.y, angle, skill: active?.skill ?? null };
    } catch {
      return null;
    }
  }, [geo, realLength, progress]);

  // ── Path segment lit around the hovered node ─────────────────
  const highlight = useMemo(() => {
    if (!geo || !hoveredId || realLength <= 0) return null;
    const hn = geo.nodes.find((n) => n.id === hoveredId);
    if (!hn || progress < hn.pathFraction) return null;
    return {
      dash: highlightDash(realLength, hn.pathFraction, HIGHLIGHT_WINDOW_PX),
      brand: hn.skill.brand,
    };
  }, [geo, hoveredId, realLength, progress]);

  if (!geo) {
    return <div ref={containerRef} className="min-h-[60vh]" aria-hidden />;
  }

  const drawn = realLength * progress;

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      style={{ height: geo.height }}
      onPointerMove={handleSectionPointerMove}
      onPointerLeave={handleSectionPointerLeave}
    >
      {/* Cluster row labels (left edge) */}
      {geo.clusterRows.map((row) => (
        <div
          key={row.cluster}
          className="absolute left-0 font-mono text-[10px] tracking-[0.25em] uppercase text-muted/70 select-none"
          style={{ top: row.y - 6 }}
          aria-hidden
        >
          {row.label}
        </div>
      ))}

      {/* SVG path */}
      <svg
        viewBox={`0 0 ${geo.width} ${geo.height}`}
        width={geo.width}
        height={geo.height}
        className="absolute inset-0 pointer-events-none"
        style={{
          transform: motionEnabled
            ? `translate3d(${-pointer.x * PATH_DEPTH * PARALLAX_MAX_PX}px, ${-pointer.y * PATH_DEPTH * PARALLAX_MAX_PX}px, 0)`
            : 'none',
          transition: 'transform 160ms ease-out',
        }}
        aria-hidden
      >
        <defs>
          <linearGradient id="constellation-stroke" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3AE0FF" stopOpacity="0.7" />
            <stop offset="50%" stopColor="#B8FF3A" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#FF3A8C" stopOpacity="0.7" />
          </linearGradient>
        </defs>
        {/* Underlying faint track */}
        <path d={geo.d} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
        {/* Animated drawn path */}
        <path
          ref={pathRef}
          d={geo.d}
          fill="none"
          stroke="url(#constellation-stroke)"
          strokeWidth={1.5}
          strokeLinecap="round"
          style={{
            strokeDasharray: realLength,
            strokeDashoffset: realLength - drawn,
            filter: 'drop-shadow(0 0 10px rgba(184,255,58,0.25))',
          }}
        />
        {/* Brand-tinted segment around the hovered node */}
        {highlight && (
          <path
            d={geo.d}
            fill="none"
            stroke={highlight.brand}
            strokeWidth={3}
            strokeLinecap="round"
            style={{
              strokeDasharray: highlight.dash.dasharray,
              strokeDashoffset: highlight.dash.dashoffset,
              filter: `drop-shadow(0 0 6px ${highlight.brand})`,
              opacity: 0.9,
            }}
          />
        )}
      </svg>

      {/* Nodes */}
      {geo.nodes.map((n, idx) => {
        const active = progress >= n.pathFraction;
        const iconPath = getIconPath(n.id);
        const factor = motionEnabled ? depthFactor(idx) : 0;
        return (
          <SkillNode
            key={n.id}
            id={n.id}
            x={n.x}
            y={n.y}
            size={nodeSize}
            active={active}
            name={n.skill.name}
            role={n.skill.role}
            years={n.skill.years}
            brand={n.skill.brand}
            iconPath={iconPath}
            offsetX={-pointer.x * factor * PARALLAX_MAX_PX}
            offsetY={-pointer.y * factor * PARALLAX_MAX_PX}
            motionEnabled={motionEnabled}
            onHoverChange={handleHoverChange}
          />
        );
      })}

      {/* Card chip riding the path */}
      {card && progress > 0.01 && progress < 0.995 && (
        <PathChip
          x={card.x + -pointer.x * PATH_DEPTH * PARALLAX_MAX_PX}
          y={card.y + -pointer.y * PATH_DEPTH * PARALLAX_MAX_PX}
          name={card.skill?.name ?? '-'}
          role={card.skill?.role ?? ''}
          brand={card.skill?.brand ?? '#B8FF3A'}
        />
      )}
    </div>
  );
}

interface ChipProps {
  x: number;
  y: number;
  name: string;
  role: string;
  brand: string;
}

function PathChip({ x, y, name, role, brand }: ChipProps) {
  return (
    <motion.div
      className="absolute pointer-events-none z-20 will-change-transform"
      style={{
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)',
      }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.25 }}
    >
      {/* trailing aura */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 rounded-full blur-2xl"
        style={{ background: `${brand}40`, transform: 'scale(2.2)' }}
      />
      {/* leading dot */}
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-2 rounded-full"
        style={{ background: brand, boxShadow: `0 0 14px ${brand}` }}
      />
      {/* pill below the dot */}
      <div className="absolute left-1/2 top-1/2 mt-5 -translate-x-1/2 whitespace-nowrap rounded-full bg-canvas/90 backdrop-blur-md border border-line/80 px-3 py-1 font-mono text-[10px] uppercase tracking-widest shadow-[0_6px_20px_rgba(0,0,0,0.5)]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={name}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22 }}
            className="flex items-center gap-2"
          >
            <span style={{ color: brand }}>→</span>
            <span className="text-text">{name}</span>
            <span className="text-muted">·</span>
            <span className="text-muted">{role}</span>
          </motion.span>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

interface NodeProps {
  id: string;
  x: number;
  y: number;
  size: number;
  active: boolean;
  name: string;
  role: string;
  years?: number;
  brand: string;
  iconPath: string | undefined;
  /** Parallax translate (px) from section pointer + this node's depth. */
  offsetX: number;
  offsetY: number;
  /** When false (reduced motion), tilt + magnet + parallax are disabled. */
  motionEnabled: boolean;
  onHoverChange: (id: string, hovered: boolean) => void;
}

function SkillNode({
  id,
  x,
  y,
  size,
  active,
  name,
  role,
  years,
  brand,
  iconPath,
  offsetX,
  offsetY,
  motionEnabled,
  onHoverChange,
}: NodeProps) {
  const [hovered, setHovered] = useState(false);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, mx: 0, my: 0 });
  const lit = active || hovered;

  const handleMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!motionEnabled) return;
      const { x: nx, y: ny } = normalizePointer(
        e.clientX,
        e.clientY,
        e.currentTarget.getBoundingClientRect(),
      );
      setTilt({
        rx: -ny * TILT_MAX_DEG,
        ry: nx * TILT_MAX_DEG,
        mx: nx * MAGNET_MAX_PX,
        my: ny * MAGNET_MAX_PX,
      });
    },
    [motionEnabled],
  );

  const enter = useCallback(() => {
    setHovered(true);
    onHoverChange(id, true);
  }, [id, onHoverChange]);

  const leave = useCallback(() => {
    setHovered(false);
    setTilt({ rx: 0, ry: 0, mx: 0, my: 0 });
    onHoverChange(id, false);
  }, [id, onHoverChange]);

  const isAnimating = motionEnabled && (hovered || offsetX !== 0 || offsetY !== 0);

  const tx = offsetX + (motionEnabled ? tilt.mx : 0);
  const ty = offsetY + (motionEnabled ? tilt.my : 0);

  return (
    <div
      className="absolute"
      style={{
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        perspective: 600,
      }}
      onPointerEnter={enter}
      onPointerLeave={leave}
      onPointerMove={handleMove}
      data-cursor-label={name.toLowerCase()}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          transform: `translate3d(${tx}px, ${ty}px, 0) rotateX(${motionEnabled ? tilt.rx : 0}deg) rotateY(${motionEnabled ? tilt.ry : 0}deg)`,
          transition: 'transform 160ms ease-out',
          willChange: isAnimating ? 'transform' : 'auto',
        }}
      >
        <motion.div
          className="size-full"
          initial={{ opacity: 0, scale: 0.4 }}
          animate={active ? { opacity: 1, scale: hovered ? 1.12 : 1 } : { opacity: 0, scale: 0.4 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22, mass: 0.6 }}
        >
          <button
            type="button"
            className="group relative size-full rounded-full bg-elevated border border-line flex items-center justify-center cursor-none focus:outline-none focus-visible:ring-2 focus-visible:ring-lime ring-offset-2 ring-offset-canvas"
            style={{
              boxShadow: hovered ? `0 0 32px -4px ${brand}` : '0 4px 12px rgba(0,0,0,0.3)',
              borderColor: hovered ? brand : undefined,
              transition: 'box-shadow 250ms ease, border-color 250ms ease',
            }}
            aria-label={`${name} - ${role}`}
          >
            {iconPath ? (
              <svg
                viewBox="0 0 24 24"
                style={{
                  width: size * 0.55,
                  height: size * 0.55,
                  fill: lit ? brand : 'rgba(245,245,240,0.85)',
                  filter: hovered
                    ? `drop-shadow(0 0 10px ${brand})`
                    : lit
                      ? `drop-shadow(0 0 6px ${brand}80)`
                      : 'none',
                  transition: 'fill 220ms ease, filter 220ms ease',
                }}
                aria-hidden
              >
                <path d={iconPath} />
              </svg>
            ) : (
              <span
                className="font-mono uppercase"
                style={{
                  fontSize: size * 0.22,
                  color: lit ? brand : undefined,
                  transition: 'color 220ms ease',
                }}
              >
                {name.slice(0, 3)}
              </span>
            )}
            <span
              className="pointer-events-none absolute left-1/2 -translate-x-1/2 -bottom-12 whitespace-nowrap rounded-md border border-line bg-elevated px-2 py-1 text-[11px] font-mono text-text opacity-0 transition-opacity group-hover:opacity-100"
              style={{ boxShadow: '0 6px 20px rgba(0,0,0,0.5)' }}
            >
              <span style={{ color: brand }}>●</span> {name}
              <span className="text-muted ml-2">
                {role}
                {years ? ` · ${years}y` : ''}
              </span>
            </span>
          </button>
        </motion.div>
      </div>
    </div>
  );
}
