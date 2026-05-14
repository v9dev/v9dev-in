import { useRef, type ReactNode, type ComponentPropsWithoutRef } from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';

interface Props extends Omit<ComponentPropsWithoutRef<'a'>, 'ref'> {
  children: ReactNode;
  /** Pull strength (0–1). Default 0.25 = subtle, 0.4 = strong. */
  strength?: number;
  /** Distance in px within which magnetism kicks in. */
  radius?: number;
  /** If true, render a <button> instead of <a>. */
  asButton?: boolean;
  onClick?: () => void;
}

/**
 * Anchor / button that pulls toward the cursor within `radius`.
 * Honors prefers-reduced-motion (becomes a regular link/button).
 */
export default function MagneticButton({
  children,
  strength = 0.25,
  radius = 80,
  asButton = false,
  onClick,
  className = '',
  ...rest
}: Props) {
  const ref = useRef<HTMLAnchorElement | HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 350, damping: 22, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 350, damping: 22, mass: 0.6 });

  const handleMove = (e: React.PointerEvent) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > radius) {
      x.set(0);
      y.set(0);
      return;
    }
    x.set(dx * strength);
    y.set(dy * strength);
  };

  const handleLeave = () => {
    x.set(0);
    y.set(0);
  };

  const Comp = asButton ? motion.button : motion.a;
  return (
    <Comp
      ref={ref as never}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      onClick={onClick}
      style={{ x: sx, y: sy }}
      className={`inline-flex items-center justify-center transition-colors ${className}`}
      {...(rest as object)}
    >
      {children}
    </Comp>
  );
}
