import { useRef, type ElementType } from 'react';
import { motion, useScroll, useTransform, type MotionValue } from 'motion/react';

interface Props {
  text: string;
  /** HTML element to render. Defaults to <p>. */
  as?: ElementType;
  className?: string;
  /** Words to highlight in the accent color when "lit". */
  accentWords?: string[];
  /** Tailwind / CSS color value applied as accent. */
  accentColor?: string;
  /** Dimmed color used before each word lights up. */
  dimColor?: string;
  /** Lit color used for non-accent words. */
  litColor?: string;
}

/**
 * Scroll-scrubbed paragraph: every word stays dim until it crosses the
 * middle of the viewport as the user scrolls through the section, then
 * lights up. Accent words light to the accent color, others to lit color.
 *
 * Uses Motion's `useScroll` on the paragraph itself; the scrub progress
 * is the paragraph's vertical position passing through the viewport.
 */
export default function ScrubReveal({
  text,
  as: Tag = 'p',
  className = '',
  accentWords = [],
  accentColor = '#FF3A8C',
  dimColor = 'rgba(139, 139, 149, 0.35)',
  litColor = '#F5F5F0',
}: Props) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.85', 'end 0.35'],
  });

  const words = text.split(/(\s+)/);
  const wordTokens = words.filter((w) => !/^\s+$/.test(w));
  const totalWords = wordTokens.length;
  const accentSet = new Set(accentWords.map((w) => w.toLowerCase().replace(/[.,!?;:]/g, '')));

  // Build an array of [start, end] ranges per word along scroll progress.
  // Each word lights over a small window so transitions overlap softly.
  const window = 0.08; // fraction of total scroll over which a single word transitions
  let wordIdx = -1;

  return (
    <Tag ref={ref as never} className={className} aria-label={text}>
      {words.map((token, i) => {
        if (/^\s+$/.test(token)) return token;
        wordIdx += 1;
        const t = totalWords > 1 ? wordIdx / (totalWords - 1) : 0;
        const start = Math.max(0, t - window / 2);
        const end = Math.min(1, t + window / 2);
        const isAccent = accentSet.has(token.toLowerCase().replace(/[.,!?;:]/g, ''));
        const targetColor = isAccent ? accentColor : litColor;
        return (
          <ScrubWord
            // biome-ignore lint/suspicious/noArrayIndexKey: stable static input
            key={i}
            token={token}
            progress={scrollYProgress}
            start={start}
            end={end}
            dimColor={dimColor}
            litColor={targetColor}
          />
        );
      })}
    </Tag>
  );
}

interface WordProps {
  token: string;
  progress: MotionValue<number>;
  start: number;
  end: number;
  dimColor: string;
  litColor: string;
}

function ScrubWord({ token, progress, start, end, dimColor, litColor }: WordProps) {
  const color = useTransform(progress, [start, end], [dimColor, litColor], { clamp: true });
  return (
    <motion.span className="inline-block" style={{ color }}>
      {token}
    </motion.span>
  );
}
