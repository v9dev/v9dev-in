import { useEffect, useRef, useState } from 'react';
import { useInView } from 'motion/react';

interface Props {
  to: number;
  /** Counts up over this many seconds. */
  duration?: number;
  /** Number of decimals. */
  decimals?: number;
  /** Prefix / suffix strings to render around the number. */
  prefix?: string;
  suffix?: string;
  className?: string;
}

/**
 * Animates a number from 0 → `to` once the element is in view.
 * Uses easeOutCubic to feel snappy at the start, slow at the end.
 */
export default function Counter({
  to,
  duration = 1.6,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / (duration * 1000), 1);
      const eased = 1 - (1 - t) ** 3;
      setValue(to * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}
