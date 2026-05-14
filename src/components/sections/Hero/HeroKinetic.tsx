import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';

interface Props {
  text: string;
}

const ACCENTS = ['#B8FF3A', '#FF3A8C', '#3AE0FF'] as const;

/**
 * Highly interactive kinetic typography hero.
 *
 *  - Letters enter from below with stagger on mount.
 *  - Each letter is magnetically pulled toward the cursor (translate).
 *  - Font weight + width axes track cursor proximity (closer = bolder + wider).
 *  - Letter color fades to an accent when the cursor is near.
 *  - Constant slow "breathe" via variable font weight oscillation.
 *  - Click anywhere on the word fires a wave that ripples through letters.
 *  - Honors prefers-reduced-motion (static, bold).
 */
export default function HeroKinetic({ text }: Props) {
  const cursorX = useMotionValue(-9999);
  const cursorY = useMotionValue(-9999);
  const cx = useSpring(cursorX, { stiffness: 250, damping: 30, mass: 0.6 });
  const cy = useSpring(cursorY, { stiffness: 250, damping: 30, mass: 0.6 });
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
    };
    window.addEventListener('pointermove', move);
    return () => {
      window.removeEventListener('pointermove', move);
      mql.removeEventListener('change', onChange);
    };
  }, [cursorX, cursorY]);

  const triggerWave = () => setWave((w) => w + 1);

  const letters = text.split('');

  if (reduced) {
    return (
      <h1
        className="font-display font-bold leading-[0.85] tracking-tight text-center text-text"
        style={{
          fontSize: 'clamp(4.5rem, 22vw, 18rem)',
          fontVariationSettings: '"wght" 700, "wdth" 100',
        }}
      >
        {text}
      </h1>
    );
  }

  return (
    <h1
      onClick={triggerWave}
      className="font-display font-bold leading-[0.85] tracking-tight text-center select-none flex flex-wrap justify-center cursor-pointer"
      style={{ fontSize: 'clamp(4.5rem, 22vw, 18rem)' }}
      aria-label={text}
      data-cursor-label="poke"
    >
      {letters.map((char, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: stable static input
        <KineticLetter key={i} char={char} index={i} cx={cx} cy={cy} wave={wave} />
      ))}
    </h1>
  );
}

interface LetterProps {
  char: string;
  index: number;
  cx: ReturnType<typeof useSpring>;
  cy: ReturnType<typeof useSpring>;
  wave: number;
}

function KineticLetter({ char, index, cx, cy, wave }: LetterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const distance = useMotionValue(9999);
  const dx = useMotionValue(0);
  const dy = useMotionValue(0);

  useEffect(() => {
    const update = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ddx = cx.get() - (rect.left + rect.width / 2);
      const ddy = cy.get() - (rect.top + rect.height / 2);
      dx.set(ddx);
      dy.set(ddy);
      distance.set(Math.hypot(ddx, ddy));
    };
    const u1 = cx.on('change', update);
    const u2 = cy.on('change', update);
    update();
    return () => {
      u1();
      u2();
    };
  }, [cx, cy, dx, dy, distance]);

  // Magnetic pull strength fades to zero past 240px.
  const pullX = useTransform([dx, distance] as const, ([ddx, d]) => {
    const dist = d as number;
    if (dist > 240) return 0;
    const k = (1 - dist / 240) * 0.25; // 0.25 = max pull factor
    return (ddx as number) * k;
  });
  const pullY = useTransform([dy, distance] as const, ([ddy, d]) => {
    const dist = d as number;
    if (dist > 240) return 0;
    const k = (1 - dist / 240) * 0.25;
    return (ddy as number) * k;
  });

  // Font weight + width axes.
  const wght = useTransform(distance, [0, 400], [820, 480], { clamp: true });
  const wdth = useTransform(distance, [0, 400], [120, 96], { clamp: true });
  const fvs = useTransform(
    [wght, wdth] as const,
    ([w, d]) => `"wght" ${w as number}, "wdth" ${d as number}`,
  );

  // Color accent fades in as the cursor approaches, picking a per-letter hue.
  const accent = ACCENTS[index % ACCENTS.length];
  const color = useTransform(distance, [0, 200, 400], [accent, accent, '#F5F5F0'], { clamp: true });

  // Drop shadow glow that ramps with proximity.
  const shadow = useTransform(distance, [0, 200, 400], [`0 0 28px ${accent}80`, `0 0 6px ${accent}40`, '0 0 0 transparent'], { clamp: true });

  return (
    <motion.span
      ref={ref}
      aria-hidden
      className="inline-block will-change-transform"
      // Entry animation: each letter rises into place with stagger.
      initial={{ y: '110%', opacity: 0, rotate: -6 }}
      animate={{ y: '0%', opacity: 1, rotate: 0 }}
      transition={{
        delay: 0.05 + index * 0.045,
        duration: 0.9,
        ease: [0.2, 0.8, 0.2, 1],
      }}
      style={{
        x: pullX,
        y: pullY,
        fontVariationSettings: fvs,
        color,
        textShadow: shadow,
      }}
    >
      <motion.span
        // Wave ripple driven by parent's `wave` counter.
        animate={
          wave > 0
            ? { y: [0, -28, 0], scale: [1, 1.18, 1] }
            : { y: 0, scale: 1 }
        }
        transition={{
          delay: index * 0.04,
          duration: 0.6,
          ease: [0.2, 0.8, 0.2, 1],
        }}
        // biome-ignore lint/correctness/useExhaustiveDependencies: wave intentional
        key={wave}
        className="inline-block"
      >
        {char === ' ' ? ' ' : char}
      </motion.span>
    </motion.span>
  );
}
