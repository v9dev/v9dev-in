import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';

type Mode = 'default' | 'text' | 'pill' | 'drag';

/**
 * GPU-transformed cursor with a sibling label.
 * Auto-disabled on touch devices and when prefers-reduced-motion is set.
 */
export default function CustomCursor() {
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const sx = useSpring(x, { stiffness: 500, damping: 35, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 500, damping: 35, mass: 0.4 });

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
        setLabel(interactive.dataset.cursorLabel ?? '← drag →');
      } else {
        setMode('pill');
        setLabel(
          interactive.dataset.cursorLabel ??
            (interactive.tagName === 'A' ? 'open ↗' : 'click'),
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

  const size = mode === 'pill' ? 96 : mode === 'drag' ? 120 : mode === 'text' ? 4 : 12;
  const height = mode === 'text' ? 22 : size === 12 ? 12 : 36;

  return (
    <>
      <motion.div
        aria-hidden
        className="fixed top-0 left-0 z-[9999] pointer-events-none rounded-full bg-text mix-blend-difference"
        style={{
          x: sx,
          y: sy,
          translateX: '-50%',
          translateY: '-50%',
          width: size,
          height,
          borderRadius: mode === 'text' ? 2 : 9999,
        }}
        animate={{ width: size, height }}
        transition={{ duration: 0.2 }}
      />
      {label && (
        <motion.div
          aria-hidden
          className="fixed top-0 left-0 z-[9999] pointer-events-none text-canvas text-xs uppercase tracking-wider font-mono"
          style={{
            x: sx,
            y: sy,
            translateX: '-50%',
            translateY: '-50%',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {label}
        </motion.div>
      )}
    </>
  );
}
