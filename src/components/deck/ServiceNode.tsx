import type { ArchNode } from '@content/architectures';
import { skillsById } from '@content/skills';
import { cn } from '@lib/cn';
import { getIconPath } from '@lib/icons';
import { easings } from '@lib/motion';
import { AnimatePresence, motion } from 'motion/react';

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
  /** Whether this in-port is the current drag-to-wire snap target. */
  snapTarget?: boolean;
  /**
   * Whether this node is online: all of its required inbound edges are wired (a
   * source node is online once the scenario is playing). Online nodes light up
   * with the brand accent + a soft glow; offline nodes are dimmed/muted.
   */
  online?: boolean;
  /** Whether this node is "up" after a boot (green accent + one-shot pulse). */
  bootUp?: boolean;
  /** Whether this node is unreachable after a boot (red outline). */
  bootUnreachable?: boolean;
  /** Disable transitions for the ring/scale affordance (reduced motion). */
  reducedMotion?: boolean;
  /** Activate the `out` port: arms this node as a wiring source. */
  onPortOut?: (id: string) => void;
  /** Activate the `in` port: targets this node from the armed source. */
  onPortIn?: (id: string) => void;
  /** Open the node detail drawer (Group E). */
  onSelect?: (id: string) => void;
  /** Begin a pointer drag-to-wire session from this node's out port. */
  onWireStart?: (id: string, e: React.PointerEvent<HTMLButtonElement>) => void;
  /** Begin a pointer drag to reposition this node's card. */
  onNodeDragStart?: (id: string, e: React.PointerEvent<HTMLButtonElement>) => void;
  /**
   * Returns true when the click that immediately follows a pointer drag should
   * be swallowed (it is the synthesized click after a reposition that moved or a
   * wire session). Reading it also clears the flag so the next genuine click
   * goes through.
   */
  consumeClickSuppressed?: () => boolean;
}

const NODE_WIDTH = 132;

export default function ServiceNode({
  node,
  x,
  y,
  armed,
  candidate,
  wiring,
  snapTarget,
  online,
  bootUp,
  bootUnreachable,
  reducedMotion,
  onPortOut,
  onPortIn,
  onSelect,
  onWireStart,
  onNodeDragStart,
  consumeClickSuppressed,
}: Props) {
  const accent = skillsById[node.skillId ?? '']?.brand ?? node.accent ?? 'var(--color-lime)';
  const iconPath = node.skillId ? getIconPath(node.skillId) : undefined;
  const fallback = node.abbr ?? node.label.slice(0, 3).toUpperCase();
  const transition = reducedMotion ? '' : 'transition-transform';

  // Boot border color, applied as an INLINE style (not a CSS-transition class):
  // under reduced motion global.css forces transition-duration to 200ms, so a
  // class-based flip would still tween - inline keeps the up/unreachable color
  // instant. Unreachable (red) wins over up (green) when both are somehow set.
  const bootBorder = bootUnreachable
    ? 'var(--color-fuchsia)'
    : bootUp
      ? 'var(--color-lime)'
      : undefined;

  // Online/offline border + glow, applied inline (same reasoning as bootBorder:
  // keep it instant under reduced motion). Online nodes take the brand accent
  // with a soft accent glow; the boot border and the armed/candidate accent both
  // outrank it. A live wiring drag keeps its own dim, so offline muting only
  // applies when nothing is being wired.
  const borderColor = bootBorder ?? (armed || candidate || online ? accent : undefined);
  // Base card drop-shadow (mirrors the Tailwind shadow class) so the inline
  // boxShadow can layer the online glow on top without dropping it.
  const baseShadow = '0 8px 24px -12px rgba(0,0,0,0.6)';
  const cardGlow =
    online && !bootBorder && !armed && !candidate
      ? `${baseShadow}, 0 0 18px -4px ${accent}55`
      : undefined;
  // Offline nodes read muted; sources/satisfied nodes are full strength. The
  // wiring dim (non-target nodes while something is armed) still wins.
  const offlineDim = wiring && !armed && !candidate ? 0.55 : online ? undefined : 0.5;

  return (
    <div
      data-node-id={node.id}
      className="absolute -translate-x-1/2 -translate-y-1/2 will-change-transform"
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
          candidate || snapTarget ? 'scale-125 border-lime ring-2 ring-lime' : 'border-line',
          snapTarget && 'scale-150',
        )}
      />

      {/* Out port (right) */}
      <button
        type="button"
        aria-label={`wire out from ${node.label}`}
        data-cursor-label="wire out"
        onClick={() => {
          // Swallow the synthesized click that trails a drag-to-wire session so
          // a drag does not also run the click-driven arm/disarm path.
          if (consumeClickSuppressed?.()) return;
          onPortOut?.(node.id);
        }}
        onPointerDown={(e) => onWireStart?.(node.id, e)}
        className={cn(
          'absolute right-0 top-1/2 z-10 size-4 translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full border bg-canvas hover:scale-125 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
          transition,
          armed ? 'scale-125 border-lime ring-2 ring-lime' : 'border-line',
        )}
      />

      <button
        type="button"
        onClick={() => {
          // Swallow the synthesized click that trails a reposition drag (one
          // that moved past the threshold) so a drag does not also fire onSelect
          // and open the detail drawer on drop.
          if (consumeClickSuppressed?.()) return;
          onSelect?.(node.id);
        }}
        onPointerDown={(e) => onNodeDragStart?.(node.id, e)}
        data-cursor-label={node.label.toLowerCase()}
        className={cn(
          'group relative flex w-full touch-none flex-col items-center gap-2 rounded-xl border border-line bg-elevated px-3 py-3 text-center shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)] hover:border-line/0 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime',
          reducedMotion ? '' : 'transition-colors',
        )}
        style={{
          borderColor,
          opacity: offlineDim,
          boxShadow: cardGlow,
        }}
      >
        {/* One-shot "up" pulse ring. Gated entirely off under reduced motion
            (the final green color is carried by the inline border above). */}
        {!reducedMotion && (
          <AnimatePresence>
            {bootUp && (
              <motion.span
                key="boot-pulse"
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-lime"
                initial={{ opacity: 0.9, scale: 1 }}
                animate={{ opacity: 0, scale: 1.18 }}
                transition={{ duration: 0.7, ease: easings.outExpo }}
              />
            )}
          </AnimatePresence>
        )}
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
