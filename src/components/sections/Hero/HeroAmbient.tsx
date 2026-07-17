import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { useEffect, useState } from 'react';

/**
 * Ambient hero background: two gradient blobs that drift on a slow CSS
 * loop and parallax against the pointer at different rates, so the lime
 * blob reads as a near layer and the fuchsia one as a far layer.
 * Reduced-motion users get the static blobs.
 */
export default function HeroAmbient() {
  const nx = useMotionValue(0); // pointer, normalized -1..1
  const ny = useMotionValue(0);
  const nxs = useSpring(nx, { stiffness: 50, damping: 20, mass: 1 });
  const nys = useSpring(ny, { stiffness: 50, damping: 20, mass: 1 });

  // Opposite directions + different travel = depth.
  const nearX = useTransform(nxs, [-1, 1], [-44, 44]);
  const nearY = useTransform(nys, [-1, 1], [-32, 32]);
  const farX = useTransform(nxs, [-1, 1], [26, -26]);
  const farY = useTransform(nys, [-1, 1], [18, -18]);

  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener('change', onChange);
    if (mql.matches) return () => mql.removeEventListener('change', onChange);

    const move = (e: PointerEvent) => {
      nx.set((e.clientX / window.innerWidth) * 2 - 1);
      ny.set((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener('pointermove', move);
    return () => {
      window.removeEventListener('pointermove', move);
      mql.removeEventListener('change', onChange);
    };
  }, [nx, ny]);

  const lime = (
    <div
      className={reduced ? undefined : 'blob-drift-a'}
      style={{
        width: '55rem',
        height: '55rem',
        borderRadius: '9999px',
        filter: 'blur(64px)',
        opacity: 0.2,
        background: 'radial-gradient(closest-side, var(--color-lime), transparent 70%)',
      }}
    />
  );
  const fuchsia = (
    <div
      className={reduced ? undefined : 'blob-drift-b'}
      style={{
        width: '50rem',
        height: '50rem',
        borderRadius: '9999px',
        filter: 'blur(64px)',
        opacity: 0.15,
        background: 'radial-gradient(closest-side, var(--color-fuchsia), transparent 70%)',
      }}
    />
  );

  if (reduced) {
    return (
      <div aria-hidden className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-40 -left-40">{lime}</div>
        <div className="absolute -bottom-32 -right-40">{fuchsia}</div>
      </div>
    );
  }

  return (
    <div aria-hidden className="absolute inset-0 -z-10 pointer-events-none overflow-hidden">
      <motion.div
        className="absolute -top-40 -left-40 will-change-transform"
        style={{ x: nearX, y: nearY }}
      >
        {lime}
      </motion.div>
      <motion.div
        className="absolute -bottom-32 -right-40 will-change-transform"
        style={{ x: farX, y: farY }}
      >
        {fuchsia}
      </motion.div>
    </div>
  );
}
