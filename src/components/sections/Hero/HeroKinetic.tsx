import { type MotionValue, motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

interface Props {
  text: string;
}

// Print-in entry timing. Letters are inked top-to-bottom strictly one at
// a time, hold wet, then the ink dries back to the hollow outline that
// the cursor-driven kinetic system expects.
const PRINT_START = 0.15; // s before the first letter starts printing
const PRINT_ROLL = 0.16; // s one letter takes to print top-to-bottom
const PRINT_HOP = 0.05; // s pause between one letter and the next
const PAINT_HOLD = 0.35;
const PAINT_DRY = 0.55;

/**
 * Modern, restrained kinetic typography for the hero.
 *
 *  - Letters print in one by one on mount: a top-to-bottom wipe reveals
 *    each solid glyph, then the fill dries back to the hollow outline.
 *  - Each letter is magnetically pulled toward the cursor (translate).
 *  - Variable font axes (wght/wdth) track cursor distance.
 *  - **Stroke ↔ fill toggle**: letters are hollow outlined when the
 *    cursor is far, fill in to solid white as it approaches.
 *  - The whole headline gets a subtle 3D perspective tilt that follows
 *    the cursor's normalized screen position.
 *  - Click to fire a wave ripple through the letters.
 *  - Honors prefers-reduced-motion.
 */
export default function HeroKinetic({ text }: Props) {
  const containerRef = useRef<HTMLHeadingElement>(null);
  const cursorX = useMotionValue(-9999);
  const cursorY = useMotionValue(-9999);
  const cx = useSpring(cursorX, { stiffness: 220, damping: 28, mass: 0.6 });
  const cy = useSpring(cursorY, { stiffness: 220, damping: 28, mass: 0.6 });

  // Normalized cursor offset from screen center, -1..1
  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const tiltXs = useSpring(tiltX, { stiffness: 90, damping: 22, mass: 0.7 });
  const tiltYs = useSpring(tiltY, { stiffness: 90, damping: 22, mass: 0.7 });
  // Convert into rotateX/Y in degrees (max ~6°).
  const rotateX = useTransform(tiltYs, [-1, 1], [6, -6]);
  const rotateY = useTransform(tiltXs, [-1, 1], [-6, 6]);

  const [reduced, setReduced] = useState(false);
  const [wave, setWave] = useState(0);
  // Entry starts only once fonts are ready so glyph metrics are final.
  const [go, setGo] = useState(false);

  useEffect(() => {
    let alive = true;
    document.fonts.ready.then(() => {
      if (alive) setGo(true);
    });
    return () => {
      alive = false;
    };
  }, []);

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

  const triggerWave = () => setWave((w) => w + 1);
  const words = text.split(/\s+/);

  if (reduced) {
    return (
      <h1
        className="font-display font-bold leading-[0.85] tracking-tight text-center text-text"
        style={{
          fontSize: 'clamp(3.5rem, 18vw, 18rem)',
          fontVariationSettings: '"wght" 720, "wdth" 100',
        }}
      >
        {text}
      </h1>
    );
  }

  // Global letter index across words, so entry stagger is continuous.
  let globalIdx = -1;

  return (
    <motion.h1
      ref={containerRef}
      onClick={triggerWave}
      className="relative font-display font-bold leading-[0.85] tracking-tight text-center select-none flex flex-col sm:flex-row sm:flex-wrap justify-center items-center sm:gap-[0.3em] cursor-pointer will-change-transform"
      style={{
        fontSize: 'clamp(3.5rem, 18vw, 18rem)',
        rotateX,
        rotateY,
        transformPerspective: 1400,
        transformStyle: 'preserve-3d',
      }}
      aria-label={text}
      data-cursor-label="poke"
    >
      {words.map((word, wi) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: stable input
        <span key={wi} className="inline-flex whitespace-nowrap">
          {word.split('').map((char) => {
            globalIdx += 1;
            return (
              <KineticLetter
                key={globalIdx}
                char={char}
                index={globalIdx}
                cx={cx}
                cy={cy}
                wave={wave}
                go={go}
              />
            );
          })}
        </span>
      ))}
    </motion.h1>
  );
}

interface LetterProps {
  char: string;
  index: number;
  cx: MotionValue<number>;
  cy: MotionValue<number>;
  wave: number;
  go: boolean;
}

function KineticLetter({ char, index, cx, cy, wave, go }: LetterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  // Print-in entry: letters ink strictly in order, each revealed by a
  // top-to-bottom wipe, then the ink "dries" back to the hollow outline.
  // Once painted, the cursor-driven stroke/fill system takes over
  // seamlessly (the paint end state matches the kinetic rest state).
  const [painted, setPainted] = useState(false);
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

  // Magnetic pull strength fades to zero past 260px.
  const pullX = useTransform([dx, distance] as const, ([ddx, d]) => {
    const dist = d as number;
    if (dist > 260) return 0;
    return (ddx as number) * (1 - dist / 260) * 0.22;
  });
  const pullY = useTransform([dy, distance] as const, ([ddy, d]) => {
    const dist = d as number;
    if (dist > 260) return 0;
    return (ddy as number) * (1 - dist / 260) * 0.22;
  });

  // Font weight + width axes - heavier and wider near the cursor.
  const wght = useTransform(distance, [0, 420], [820, 480], { clamp: true });
  const wdth = useTransform(distance, [0, 420], [120, 92], { clamp: true });
  const fvs = useTransform(
    [wght, wdth] as const,
    ([w, d]) => `"wght" ${w as number}, "wdth" ${d as number}`,
  );

  // Stroke ↔ fill: solid white near the cursor, hollow outline farther.
  // We interpolate stroke width and fill opacity.
  const fillOpacity = useTransform(distance, [80, 280], [1, 0], { clamp: true });
  const strokeWidth = useTransform(distance, [80, 280], [0, 1.4], { clamp: true });
  // Compose into an inline style (computed string) on the inner span.
  const styleStroke = useTransform(strokeWidth, (w) => `${w}px var(--color-text)`);
  const styleColor = useTransform(fillOpacity, (o) => `rgba(245, 245, 240, ${o})`);

  // Full paint timeline: roll down under the roller, hold wet, dry to outline.
  const paintDelay = PRINT_START + index * (PRINT_ROLL + PRINT_HOP);
  const paintTotal = PRINT_ROLL + PAINT_HOLD + PAINT_DRY;

  return (
    <motion.span
      ref={ref}
      aria-hidden
      className="kinetic-letter inline-block will-change-transform"
      style={{ x: pullX, y: pullY, fontVariationSettings: fvs }}
    >
      <motion.span
        // biome-ignore lint/correctness/useExhaustiveDependencies: wave intentional
        key={wave}
        animate={wave > 0 ? { y: [0, -32, 0], scale: [1, 1.16, 1] } : { y: 0, scale: 1 }}
        transition={{
          delay: index * 0.04,
          duration: 0.7,
          ease: [0.2, 0.8, 0.2, 1],
        }}
        className="inline-block"
      >
        {painted ? (
          <motion.span
            className="inline-block"
            style={{
              color: styleColor,
              // text-stroke draws an outline; combined with translucent fill it
              // gives the "hollow" look at distance.
              WebkitTextStroke: styleStroke,
            }}
          >
            {char === ' ' ? ' ' : char}
          </motion.span>
        ) : go ? (
          <motion.span
            className="inline-block"
            initial={{
              clipPath: 'inset(-15% -8% 100% -8%)',
              color: 'rgba(245, 245, 240, 1)',
            }}
            animate={{
              // Top-to-bottom wipe matching the roller rolling down this
              // letter, a wet hold, then the fill dries out leaving only
              // the outline - the kinetic rest state.
              clipPath: [
                'inset(-15% -8% 100% -8%)',
                'inset(-15% -8% -15% -8%)',
                'inset(-15% -8% -15% -8%)',
                'inset(-15% -8% -15% -8%)',
              ],
              color: [
                'rgba(245, 245, 240, 1)',
                'rgba(245, 245, 240, 1)',
                'rgba(245, 245, 240, 1)',
                'rgba(245, 245, 240, 0)',
              ],
            }}
            transition={{
              delay: paintDelay,
              duration: paintTotal,
              times: [0, PRINT_ROLL / paintTotal, (PRINT_ROLL + PAINT_HOLD) / paintTotal, 1],
              // Wipe eases with the roller's roll-down, dry-out stays gentle.
              ease: ['easeInOut', 'linear', 'easeInOut'],
            }}
            onAnimationComplete={() => setPainted(true)}
            style={{ WebkitTextStroke: '1.4px var(--color-text)' }}
          >
            {char === ' ' ? ' ' : char}
          </motion.span>
        ) : (
          // Waiting for fonts/measure - keep the letter hidden.
          <span
            className="inline-block"
            style={{
              clipPath: 'inset(-15% -8% 100% -8%)',
              WebkitTextStroke: '1.4px var(--color-text)',
              color: 'rgba(245, 245, 240, 1)',
            }}
          >
            {char === ' ' ? ' ' : char}
          </span>
        )}
      </motion.span>
    </motion.span>
  );
}
