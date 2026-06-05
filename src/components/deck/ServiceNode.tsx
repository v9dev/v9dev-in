import type { ArchNode } from '@content/architectures';
import { skillsById } from '@content/skills';
import { cn } from '@lib/cn';
import { getIconPath } from '@lib/icons';

interface Props {
  node: ArchNode;
  x: number;
  y: number;
  /** Whether this node is currently the armed wiring source. */
  armed?: boolean;
  /** Whether this node is a valid target while another node is armed. */
  candidate?: boolean;
  /** Whether wiring is in progress at all (something is armed). */
  wiring?: boolean;
  /** Disable transitions for the ring/scale affordance (reduced motion). */
  reducedMotion?: boolean;
  /** Activate the `out` port: arms this node as a wiring source. */
  onPortOut?: (id: string) => void;
  /** Activate the `in` port: targets this node from the armed source. */
  onPortIn?: (id: string) => void;
  /** Open the node detail drawer (Group E). */
  onSelect?: (id: string) => void;
}

const NODE_WIDTH = 132;

export default function ServiceNode({
  node,
  x,
  y,
  armed,
  candidate,
  wiring,
  reducedMotion,
  onPortOut,
  onPortIn,
  onSelect,
}: Props) {
  const accent = skillsById[node.skillId ?? '']?.brand ?? node.accent ?? 'var(--color-lime)';
  const iconPath = node.skillId ? getIconPath(node.skillId) : undefined;
  const fallback = node.abbr ?? node.label.slice(0, 3).toUpperCase();
  const transition = reducedMotion ? '' : 'transition-transform';

  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: x, top: y, width: NODE_WIDTH }}
    >
      {/* In port (left) */}
      <button
        type="button"
        aria-label={`wire into ${node.label}`}
        data-cursor-label="wire in"
        onClick={() => onPortIn?.(node.id)}
        className={cn(
          'absolute left-0 top-1/2 z-10 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border bg-canvas hover:scale-125 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
          transition,
          candidate ? 'scale-125 border-lime ring-2 ring-lime' : 'border-line',
        )}
      />

      {/* Out port (right) */}
      <button
        type="button"
        aria-label={`wire out from ${node.label}`}
        data-cursor-label="wire out"
        onClick={() => onPortOut?.(node.id)}
        className={cn(
          'absolute right-0 top-1/2 z-10 size-4 translate-x-1/2 -translate-y-1/2 rounded-full border bg-canvas hover:scale-125 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
          transition,
          armed ? 'scale-125 border-lime ring-2 ring-lime' : 'border-line',
        )}
      />

      <button
        type="button"
        onClick={() => onSelect?.(node.id)}
        data-cursor-label={node.label.toLowerCase()}
        className={cn(
          'group flex w-full flex-col items-center gap-2 rounded-xl border border-line bg-elevated px-3 py-3 text-center shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)] hover:border-line/0 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime',
          reducedMotion ? '' : 'transition-colors',
        )}
        style={{
          borderColor: armed || candidate ? accent : undefined,
          opacity: wiring && !armed && !candidate ? 0.55 : undefined,
        }}
      >
        <span
          className="flex size-9 items-center justify-center rounded-lg border border-line/60"
          style={{ boxShadow: `inset 0 0 0 1px ${accent}22` }}
        >
          {iconPath ? (
            <svg
              viewBox="0 0 24 24"
              className="size-5"
              style={{ fill: accent }}
              role="img"
              aria-label={`${node.label} icon`}
            >
              <title>{`${node.label} icon`}</title>
              <path d={iconPath} />
            </svg>
          ) : (
            <span className="font-mono text-[11px] font-semibold" style={{ color: accent }}>
              {fallback}
            </span>
          )}
        </span>
        <span className="font-mono text-[11px] leading-tight text-text">{node.label}</span>
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted">
          {node.kind}
        </span>
      </button>
    </div>
  );
}
