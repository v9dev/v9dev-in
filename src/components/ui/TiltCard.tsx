import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from 'motion/react';
import { type ReactNode, useEffect, useRef, useState } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
  /** Max tilt in degrees. */
  maxTilt?: number;
}

/**
 * Pointer-tracked 3D tilt surface with a specular glare sweep on hover.
 * Tilt only activates on fine pointers with hover capability; touch and
 * reduced-motion users get the plain card.
 */
export default function TiltCard({ children, className, maxTilt = 6 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [hovered, setHovered] = useState(false);

  // Cursor position inside the card, 0..1 on both axes.
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const pxs = useSpring(px, { stiffness: 180, damping: 24, mass: 0.6 });
  const pys = useSpring(py, { stiffness: 180, damping: 24, mass: 0.6 });

  const rotateX = useTransform(pys, [0, 1], [maxTilt, -maxTilt]);
  const rotateY = useTransform(pxs, [0, 1], [-maxTilt, maxTilt]);

  const glareX = useTransform(pxs, [0, 1], ['0%', '100%']);
  const glareY = useTransform(pys, [0, 1], ['0%', '100%']);
  const glare = useMotionTemplate`radial-gradient(34rem circle at ${glareX} ${glareY}, rgba(255,255,255,0.07), transparent 55%)`;

  useEffect(() => {
    setEnabled(
      window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
  }, []);

  if (!enabled) {
    return <div className={className}>{children}</div>;
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    px.set((e.clientX - rect.left) / rect.width);
    py.set((e.clientY - rect.top) / rect.height);
  };

  const onPointerLeave = () => {
    px.set(0.5);
    py.set(0.5);
    setHovered(false);
  };

  return (
    <motion.div
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={onPointerLeave}
      className={className}
      animate={{ scale: hovered ? 1.012 : 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      style={{
        rotateX,
        rotateY,
        transformPerspective: 1100,
        willChange: 'transform',
      }}
    >
      {children}
      {/* Specular glare tracking the cursor */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{ background: glare, opacity: hovered ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      />
    </motion.div>
  );
}
