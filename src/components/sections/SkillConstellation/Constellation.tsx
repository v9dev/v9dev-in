import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { buildConstellation, type ConstellationGeometry } from './path';
import { getIconPath } from '@lib/icons';

const ROW_HEIGHT_DESKTOP = 180;
const ROW_HEIGHT_MOBILE = 220;
const PAD_X_DESKTOP = 80;
const PAD_X_MOBILE = 40;
const PAD_Y = 80;
const NODE_SIZE = 56;

export default function Constellation() {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const [geo, setGeo] = useState<ConstellationGeometry | null>(null);
  const [progress, setProgress] = useState(0);

  // ── Compute geometry from container width ────────────────────
  useLayoutEffect(() => {
    const compute = () => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const width = Math.max(rect.width, 320);
      const mobile = width < 768;
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
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setProgress(1);
      return;
    }

    let raf = 0;
    const tick = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // Section enters at bottom of viewport (rect.top = vh) → progress 0
      // Section finishes when its bottom reaches top of viewport → progress 1
      const start = vh * 0.85;
      const end = -rect.height + vh * 0.15;
      const raw = (start - rect.top) / (start - end);
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

  if (!geo) {
    return <div ref={containerRef} className="min-h-[60vh]" aria-hidden />;
  }

  const drawn = realLength * progress;

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: geo.height }}>
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
        <path
          d={geo.d}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={1}
        />
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
      </svg>

      {/* Nodes */}
      {geo.nodes.map((n) => {
        const active = progress >= n.pathFraction;
        const iconPath = getIconPath(n.id);
        return (
          <SkillNode
            key={n.id}
            x={n.x}
            y={n.y}
            active={active}
            name={n.skill.name}
            role={n.skill.role}
            years={n.skill.years}
            brand={n.skill.brand}
            iconPath={iconPath}
          />
        );
      })}
    </div>
  );
}

interface NodeProps {
  x: number;
  y: number;
  active: boolean;
  name: string;
  role: string;
  years?: number;
  brand: string;
  iconPath: string | undefined;
}

function SkillNode({ x, y, active, name, role, years, brand, iconPath }: NodeProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      className="absolute"
      style={{
        left: x - NODE_SIZE / 2,
        top: y - NODE_SIZE / 2,
        width: NODE_SIZE,
        height: NODE_SIZE,
      }}
      initial={{ opacity: 0, scale: 0.4 }}
      animate={
        active
          ? { opacity: 1, scale: hovered ? 1.12 : 1 }
          : { opacity: 0, scale: 0.4 }
      }
      transition={{ type: 'spring', stiffness: 380, damping: 22, mass: 0.6 }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      data-cursor-label={name.toLowerCase()}
    >
      <button
        type="button"
        className="group relative size-full rounded-full bg-elevated border border-line flex items-center justify-center cursor-none focus:outline-none focus-visible:ring-2 focus-visible:ring-lime ring-offset-2 ring-offset-canvas"
        style={{
          boxShadow: hovered ? `0 0 32px -4px ${brand}` : '0 4px 12px rgba(0,0,0,0.3)',
          borderColor: hovered ? brand : undefined,
          transition: 'box-shadow 250ms ease, border-color 250ms ease',
        }}
        aria-label={`${name} — ${role}`}
      >
        {iconPath ? (
          <svg
            viewBox="0 0 24 24"
            className="size-7"
            style={{
              fill: hovered ? brand : 'rgba(245,245,240,0.85)',
              filter: hovered ? `drop-shadow(0 0 8px ${brand}80)` : 'none',
              transition: 'fill 220ms ease, filter 220ms ease',
            }}
            aria-hidden
          >
            <path d={iconPath} />
          </svg>
        ) : (
          <span
            className="font-mono text-[10px] uppercase"
            style={{
              color: hovered ? brand : undefined,
              transition: 'color 220ms ease',
            }}
          >
            {name.slice(0, 3)}
          </span>
        )}
        {/* Tooltip */}
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
  );
}
