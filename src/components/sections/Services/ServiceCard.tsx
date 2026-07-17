import type { Service } from '@content/services';
import { type MotionStyle, motion, useScroll, useTransform } from 'motion/react';
import { useRef } from 'react';

interface Props {
  service: Service;
  /** Index in the stack (0-based). */
  index: number;
  /** Total cards - used to compute final scale of bottom card. */
  total: number;
}

const accentMap = {
  lime: 'var(--color-lime)',
  fuchsia: 'var(--color-fuchsia)',
  cyan: 'var(--color-cyan)',
} as const;

/**
 * One sticky-pinning service card. As the user scrolls past, the card
 * scales down slightly to suggest depth, then the next one pins on top.
 */
export default function ServiceCard({ service, index, total }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });

  // Scale down a tiny bit as the next card pins on top
  const isLast = index === total - 1;
  const scale = useTransform(scrollYProgress, [0, 1], [1, isLast ? 1 : 0.92]);
  const opacity = useTransform(scrollYProgress, [0, 0.9, 1], [1, 1, isLast ? 1 : 0.6]);

  const accent = accentMap[service.accent];

  return (
    <div
      ref={ref}
      // Pin cards to the TOP (not centered) with a small per-card staircase so a
      // rising card covers the previous one cleanly from the bottom up - it never
      // slices through the previous card's title the way a centered stack does.
      className="sticky top-0 flex h-screen items-start justify-center px-4"
      style={{ paddingTop: `calc(5rem + ${index} * 1.5rem)` }}
    >
      <motion.article
        // Scale from the top edge so the outgoing card shrinks UP (its top stays
        // put) as the next one slides over it - keeps the stack edges aligned.
        style={
          {
            scale,
            opacity,
            transformOrigin: 'top center',
            '--accent': accent,
          } as MotionStyle
        }
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          e.currentTarget.style.setProperty('--spot-x', `${e.clientX - rect.left}px`);
          e.currentTarget.style.setProperty('--spot-y', `${e.clientY - rect.top}px`);
        }}
        className="group/card relative w-full max-w-5xl overflow-hidden rounded-3xl border border-line/80 bg-elevated/85 p-8 backdrop-blur-xl md:p-12 lg:p-16"
      >
        {/* Accent corner glow */}
        <div
          aria-hidden
          className="absolute -top-32 -right-32 size-[28rem] rounded-full blur-3xl opacity-25 pointer-events-none"
          style={{ background: `radial-gradient(closest-side, ${accent}, transparent 70%)` }}
        />
        {/* Cursor spotlight - lights the surface under the pointer */}
        <div
          aria-hidden
          className="card-spotlight pointer-events-none absolute inset-0 opacity-0 group-hover/card:opacity-100 transition-opacity duration-500"
        />

        <div className="relative flex flex-col md:flex-row md:items-start gap-8 md:gap-12">
          <div className="md:w-1/3 flex-shrink-0">
            <div
              className="font-mono text-[64px] md:text-[96px] leading-none font-bold tracking-tight"
              style={{ color: accent }}
            >
              {service.num}
            </div>
            <h3 className="mt-4 font-display text-2xl md:text-4xl font-semibold leading-tight">
              {service.title}
            </h3>
            <p className="mt-2 font-mono text-xs uppercase tracking-widest text-muted">
              {service.tagline}
            </p>
          </div>

          <div className="md:w-2/3">
            <p className="text-lg md:text-xl leading-relaxed text-text/90 text-balance">
              {service.blurb}
            </p>
            <ul className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {service.deliverables.map((d) => (
                <li
                  key={d}
                  className="deliverable-pill flex items-center gap-3 rounded-full border border-line/60 bg-canvas/50 px-4 py-2 font-mono text-xs"
                >
                  <span
                    aria-hidden
                    className="pill-dot size-1.5 rounded-full"
                    style={{ background: accent, boxShadow: `0 0 8px ${accent}` }}
                  />
                  {d}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </motion.article>
    </div>
  );
}
