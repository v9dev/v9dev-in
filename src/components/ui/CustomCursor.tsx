import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useSpring } from 'motion/react';

type Mode = 'default' | 'text' | 'interactive' | 'drag';

/**
 * Small dot cursor with a label that sits offset to the bottom-right -
 * never overlaps the element you're hovering. Auto-disabled on touch
 * devices and when prefers-reduced-motion is set.
 */
export default function CustomCursor() {
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const sx = useSpring(x, { stiffness: 700, damping: 35, mass: 0.3 });
  const sy = useSpring(y, { stiffness: 700, damping: 35, mass: 0.3 });

  const [mode, setMode] = useState<Mode>('default');
  const [label, setLabel] = useState('');
  const enabledRef = useRef(false);

  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)').matches;
    const rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || rm) return;
    enabledRef.current = true;
    document.documentElement.classList.add('has-custom-cursor');

    const move = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };

    const over = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const interactive = t.closest<HTMLElement>(
        'a, button, [role="button"], input, textarea, select, [data-cursor]',
      );
      if (!interactive) {
        setMode(t.matches('p, h1, h2, h3, h4, span') ? 'text' : 'default');
        setLabel('');
        return;
      }
      const cursorAttr = interactive.dataset.cursor;
      if (cursorAttr === 'drag') {
        setMode('drag');
        setLabel(interactive.dataset.cursorLabel ?? 'drag');
      } else {
        setMode('interactive');
        setLabel(
          interactive.dataset.cursorLabel ??
            (interactive.tagName === 'A' ? 'open' : 'click'),
        );
      }
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerover', over);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerover', over);
      document.documentElement.classList.remove('has-custom-cursor');
    };
  }, [x, y]);

  // Dot: small for default/interactive/drag, tiny caret for text-hover.
  const isCaret = mode === 'text';
  const dotSize = isCaret ? 3 : mode === 'default' ? 8 : 10;
  const dotHeight = isCaret ? 20 : dotSize;
  const accent =
    mode === 'drag' ? '#3AE0FF' : mode === 'interactive' ? '#B8FF3A' : '#F5F5F0';

  return (
    <>
      {/* The dot itself stays small and centered on the actual pointer */}
      <motion.div
        aria-hidden
        className="fixed top-0 left-0 z-[9999] pointer-events-none rounded-full"
        style={{
          x: sx,
          y: sy,
          translateX: '-50%',
          translateY: '-50%',
          width: dotSize,
          height: dotHeight,
          background: accent,
          mixBlendMode: 'difference',
          borderRadius: isCaret ? 2 : 9999,
        }}
        animate={{ width: dotSize, height: dotHeight }}
        transition={{ duration: 0.18 }}
      />

      {/* Label sits offset below-right so it never covers the target */}
      <motion.div
        aria-hidden
        className="fixed top-0 left-0 z-[9999] pointer-events-none"
        style={{
          x: sx,
          y: sy,
        }}
      >
        <AnimatePresence>
          {label && (mode === 'interactive' || mode === 'drag') && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, x: 6, y: 6 }}
              animate={{ opacity: 1, scale: 1, x: 14, y: 14 }}
              exit={{ opacity: 0, scale: 0.8, x: 6, y: 6 }}
              transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
              className="origin-top-left rounded-full bg-canvas border border-line/80 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-text whitespace-nowrap shadow-[0_4px_14px_rgba(0,0,0,0.5)]"
              style={{ color: accent }}
            >
              {mode === 'drag' ? `← ${label} →` : `${label} ↗`}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
}
