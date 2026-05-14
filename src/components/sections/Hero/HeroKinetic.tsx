import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';

interface Props {
  text: string;
}

/**
 * Kinetic typography for the hero. Each letter's `font-variation-settings`
 * (`wght`, `wdth`) follow the cursor distance: closer = bolder + wider.
 * The whole word also subtly shifts weight with scroll progress.
 * Falls back to static text under prefers-reduced-motion.
 */
export default function HeroKinetic({ text }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cursorX = useMotionValue(0);
  const cursorY = useMotionValue(0);
  const cx = useSpring(cursorX, { stiffness: 200, damping: 35, mass: 0.6 });
  const cy = useSpring(cursorY, { stiffness: 200, damping: 35, mass: 0.6 });
  const [reduced, setReduced] = useState(false);

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
      ref={containerRef}
      className="font-display font-bold leading-[0.85] tracking-tight text-center select-none flex flex-wrap justify-center"
      style={{ fontSize: 'clamp(4.5rem, 22vw, 18rem)' }}
      aria-label={text}
    >
      {letters.map((char, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: stable static input
        <KineticLetter key={i} char={char} index={i} cx={cx} cy={cy} />
      ))}
    </h1>
  );
}

interface LetterProps {
  char: string;
  index: number;
  cx: ReturnType<typeof useSpring>;
  cy: ReturnType<typeof useSpring>;
}

function KineticLetter({ char, cx, cy }: LetterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const distance = useMotionValue(9999);

  useEffect(() => {
    const update = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const dx = cx.get() - (rect.left + rect.width / 2);
      const dy = cy.get() - (rect.top + rect.height / 2);
      distance.set(Math.hypot(dx, dy));
    };
    const unsubX = cx.on('change', update);
    const unsubY = cy.on('change', update);
    update();
    return () => {
      unsubX();
      unsubY();
    };
  }, [cx, cy, distance]);

  // 0 distance → 800 wght / 110 wdth ; 400px+ distance → 400 wght / 95 wdth
  const wght = useTransform(distance, [0, 400], [800, 400], { clamp: true });
  const wdth = useTransform(distance, [0, 400], [115, 95], { clamp: true });
  const fvs = useTransform([wght, wdth] as const, ([w, d]) =>
    `"wght" ${w as number}, "wdth" ${d as number}`,
  );

  return (
    <motion.span
      ref={ref}
      aria-hidden
      className="inline-block"
      style={{ fontVariationSettings: fvs }}
    >
      {char === ' ' ? ' ' : char}
    </motion.span>
  );
}
