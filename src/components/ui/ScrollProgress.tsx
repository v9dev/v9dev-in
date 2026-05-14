import { useEffect, useState } from 'react';
import { motion, useScroll, useSpring } from 'motion/react';

/**
 * Thin progress bar tracking page scroll, plus a section counter (NN / NN)
 * that reads from `<section data-index>` attributes.
 */
export default function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 26, mass: 0.5 });

  const [current, setCurrent] = useState(1);
  const [total, setTotal] = useState(1);

  useEffect(() => {
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>('section[data-index]'),
    );
    if (sections.length === 0) return;
    setTotal(sections.length);

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          const idx = Number(visible.target.getAttribute('data-index') ?? '1');
          setCurrent(idx);
        }
      },
      { threshold: [0.25, 0.5, 0.75] },
    );
    for (const s of sections) io.observe(s);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <motion.div
        className="fixed top-0 left-0 right-0 h-px origin-left z-50 bg-lime"
        style={{ scaleX }}
        aria-hidden
      />
      <div
        className="fixed bottom-6 right-6 z-40 font-mono text-xs tracking-widest text-muted uppercase pointer-events-none mix-blend-difference"
        aria-hidden
      >
        <span className="text-text">{String(current).padStart(2, '0')}</span>
        <span className="opacity-50"> / {String(total).padStart(2, '0')}</span>
      </div>
    </>
  );
}
