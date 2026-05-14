import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

const lines = [
  'Available for work · 2026',
  'Currently shipping multi-region k8s',
  'Recently: real-time analytics pipeline',
  'Open to FDE engagements globally',
  'Replies in under 24h',
] as const;

/**
 * Cycles through a few "live" status strings underneath a pulsing dot.
 * Lightweight: no scheduler - just a setTimeout chain that pauses
 * when the tab is hidden.
 */
export default function HeroStatus() {
  const [i, setI] = useState(0);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (document.visibilityState === 'visible') {
        setI((prev) => (prev + 1) % lines.length);
      }
      t = setTimeout(tick, 4200);
    };
    t = setTimeout(tick, 4200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-muted mb-8 flex items-center gap-3 h-4">
      <span className="relative flex size-1.5">
        <span className="absolute inset-0 rounded-full bg-lime animate-ping opacity-75" />
        <span className="relative rounded-full bg-lime size-1.5" />
      </span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {lines[i]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
