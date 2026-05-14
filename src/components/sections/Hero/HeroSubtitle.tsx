import { useEffect, useState } from 'react';
import { motion, useInView } from 'motion/react';
import { useRef } from 'react';

interface Props {
  text: string;
  /** Characters per second */
  speed?: number;
}

/**
 * Types text out a character at a time once in view. Cursor caret blinks
 * until the text finishes typing.
 */
export default function HeroSubtitle({ text, speed = 28 }: Props) {
  const ref = useRef<HTMLParagraphElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const [shown, setShown] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!inView) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setShown(text);
      setDone(true);
      return;
    }
    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, 1000 / speed);
    return () => clearInterval(interval);
  }, [inView, text, speed]);

  return (
    <p
      ref={ref}
      className="font-mono text-sm md:text-base text-muted tracking-tight text-balance text-center max-w-2xl mx-auto"
      aria-label={text}
    >
      <span aria-hidden>{shown}</span>
      <motion.span
        aria-hidden
        className="inline-block bg-lime ml-0.5"
        style={{ width: '0.55em', height: '1em', verticalAlign: '-0.15em' }}
        animate={{ opacity: done ? [1, 0, 1] : 1 }}
        transition={done ? { duration: 1, repeat: Infinity, ease: 'linear' } : undefined}
      />
    </p>
  );
}
