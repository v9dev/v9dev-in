import { motion, useInView } from 'motion/react';
import { useRef, type ElementType } from 'react';
import { easings } from '@lib/motion';

interface Props {
  text: string;
  /** HTML element to render. Defaults to <p>. */
  as?: ElementType;
  className?: string;
  /** Stagger between words. */
  stagger?: number;
  /** Word-level highlights - words whose text exactly matches get accent. */
  accentWords?: string[];
  /** Tailwind class for accent words. */
  accentClass?: string;
}

/**
 * Splits text into words and reveals them with translateY + opacity stagger
 * when the container enters the viewport. Single-fire by default.
 */
export default function RevealText({
  text,
  as: Tag = 'p',
  className = '',
  stagger = 0.04,
  accentWords = [],
  accentClass = 'text-lime',
}: Props) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const words = text.split(/(\s+)/);
  const accentSet = new Set(accentWords.map((w) => w.toLowerCase()));

  return (
    <Tag
      ref={ref as never}
      className={className}
      aria-label={text}
    >
      {words.map((word, i) => {
        if (/^\s+$/.test(word)) return word;
        const isAccent = accentSet.has(word.toLowerCase().replace(/[.,!?;:]/g, ''));
        return (
          <motion.span
            // biome-ignore lint/suspicious/noArrayIndexKey: stable static array
            key={i}
            aria-hidden
            className={`inline-block ${isAccent ? accentClass : ''}`}
            initial={{ opacity: 0, y: 18 }}
            animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
            transition={{
              duration: 0.6,
              ease: easings.outExpo,
              delay: i * stagger * 0.5,
            }}
          >
            {word}
          </motion.span>
        );
      })}
    </Tag>
  );
}
