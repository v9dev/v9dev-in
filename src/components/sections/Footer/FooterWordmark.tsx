import { useEffect, useRef, useState } from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from 'motion/react';

/**
 * Massive end-of-page wordmark. Each letter is outlined by default and
 * fills in with the lime accent when the cursor approaches. The whole
 * lockup also tilts subtly in 3D following the cursor, and a constant
 * slow weight-breathe runs for ambient life.
 *
 * Click → fires a wave ripple through the letters. RM-aware.
 */
export default function FooterWordmark({ text = 'V9DEV' }: { text?: string }) {
  const cursorX = useMotionValue(-9999);
  const cursorY = useMotionValue(-9999);
  const cx = useSpring(cursorX, { stiffness: 200, damping: 26, mass: 0.7 });
  const cy = useSpring(cursorY, { stiffness: 200, damping: 26, mass: 0.7 });

  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const tiltXs = useSpring(tiltX, { stiffness: 90, damping: 22, mass: 0.7 });
  const tiltYs = useSpring(tiltY, { stiffness: 90, damping: 22, mass: 0.7 });
  const rotateX = useTransform(tiltYs, [-1, 1], [4, -4]);
  const rotateY = useTransform(tiltXs, [-1, 1], [-4, 4]);

  const [reduced, setReduced] = useState(false);
  const [wave, setWave] = useState(0);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener('change', onChange);
    if (mql.matches) return () => mql.removeEventListener('change', onChange);

    const move = (e: PointerEvent) => {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
      tiltX.set((e.clientX / window.innerWidth) * 2 - 1);
      tiltY.set((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('pointermove', move);
    return () => {
      window.removeEventListener('pointermove', move);
      mql.removeEventListener('change', onChange);
    };
  }, [cursorX, cursorY, tiltX, tiltY]);

  const letters = text.split('');

  if (reduced) {
    return (
      <div
        aria-hidden
        className="font-display font-black leading-[0.85] tracking-tighter select-none mb-12"
        style={{
          fontSize: 'clamp(5rem, 28vw, 24rem)',
          WebkitTextStroke: '1.5px var(--color-text)',
          color: 'transparent',
        }}
      >
        {text}
      </div>
    );
  }

  return (
    <motion.div
      aria-hidden
      onClick={() => setWave((w) => w + 1)}
      className="font-display font-black leading-[0.85] tracking-tighter select-none mb-12 flex justify-between cursor-pointer will-change-transform"
      style={{
        fontSize: 'clamp(5rem, 28vw, 24rem)',
        rotateX,
        rotateY,
        transformPerspective: 1400,
        transformStyle: 'preserve-3d',
      }}
      data-cursor-label="hi"
    >
      {letters.map((char, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: stable input
        <Letter key={i} char={char} index={i} cx={cx} cy={cy} wave={wave} />
      ))}
    </motion.div>
  );
}

interface LetterProps {
  char: string;
  index: number;
  cx: MotionValue<number>;
  cy: MotionValue<number>;
  wave: number;
}

function Letter({ char, index, cx, cy, wave }: LetterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const distance = useMotionValue(9999);

  useEffect(() => {
    const update = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ddx = cx.get() - (rect.left + rect.width / 2);
      const ddy = cy.get() - (rect.top + rect.height / 2);
      distance.set(Math.hypot(ddx, ddy));
    };
    const u1 = cx.on('change', update);
    const u2 = cy.on('change', update);
    update();
    return () => {
      u1();
      u2();
    };
  }, [cx, cy, distance]);

  // Outline by default; near cursor, fill in with lime accent.
  const fillOpacity = useTransform(distance, [80, 320], [1, 0], { clamp: true });
  const strokeWidth = useTransform(distance, [80, 320], [0, 1.6], { clamp: true });
  const colorVal = useTransform(fillOpacity, (o) =>
    o > 0.05 ? `rgba(184, 255, 58, ${o})` : 'transparent',
  );
  const stroke = useTransform(strokeWidth, (w) => `${w}px var(--color-text)`);

  return (
    <motion.span
      ref={ref}
      className="inline-block will-change-transform"
      initial={{ y: 30, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{
        delay: 0.05 + index * 0.06,
        duration: 0.7,
        ease: [0.2, 0.8, 0.2, 1],
      }}
    >
      <motion.span
        // biome-ignore lint/correctness/useExhaustiveDependencies: wave intentional
        key={wave}
        animate={wave > 0 ? { y: [0, -20, 0], scale: [1, 1.08, 1] } : { y: 0 }}
        transition={{
          delay: index * 0.04,
          duration: 0.65,
          ease: [0.2, 0.8, 0.2, 1],
        }}
        className="inline-block"
        style={{
          color: colorVal,
          WebkitTextStroke: stroke,
        }}
      >
        {char}
      </motion.span>
    </motion.span>
  );
}
