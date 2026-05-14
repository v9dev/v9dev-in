import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type Lenis from 'lenis';

interface LinkItem {
  label: string;
  href: string;
}

interface SocialItem {
  label: string;
  href: string;
}

interface Props {
  links: LinkItem[];
  socials: SocialItem[];
  email: string;
}

/**
 * Mobile-only hamburger trigger + full-screen overlay menu.
 * Hidden from `md` up (md:hidden on the trigger, md:hidden on overlay).
 *
 * Locks page scroll (both native and Lenis) while open. Closes on:
 *   - Link tap
 *   - X button
 *   - Escape key
 *   - Backdrop tap
 *   - Viewport widening past md (handles rotation)
 */
export default function MobileMenu({ links, socials, email }: Props) {
  const [open, setOpen] = useState(false);

  // Body + Lenis scroll lock
  useEffect(() => {
    const lenis = (window as unknown as { __lenis?: Lenis }).__lenis;
    if (open) {
      document.documentElement.style.overflow = 'hidden';
      lenis?.stop();
    } else {
      document.documentElement.style.overflow = '';
      lenis?.start();
    }
    return () => {
      document.documentElement.style.overflow = '';
      lenis?.start();
    };
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Close if user resizes past the md breakpoint (e.g. landscape rotation)
  useEffect(() => {
    if (!open) return;
    const mql = window.matchMedia('(min-width: 768px)');
    const onChange = () => {
      if (mql.matches) setOpen(false);
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((o) => !o)}
        className="md:hidden inline-flex items-center justify-center size-9 rounded-full hover:bg-elevated-hi transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-lime"
        data-cursor-label={open ? 'close' : 'menu'}
      >
        <Burger open={open} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            className="md:hidden fixed inset-0 z-50 bg-canvas/95 backdrop-blur-xl flex flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => {
              // backdrop tap only - not link / button
              if (e.target === e.currentTarget) setOpen(false);
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
          >
            {/* Top bar */}
            <div className="flex items-center justify-between px-5 pt-5">
              <a
                href="#hero"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-2"
                aria-label="Back to top"
              >
                <span
                  className="inline-block size-2 rounded-full bg-lime"
                  style={{ boxShadow: '0 0 12px 2px var(--color-lime)' }}
                  aria-hidden
                />
                <span className="font-mono uppercase text-xs tracking-widest">
                  v9dev
                </span>
              </a>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center size-9 rounded-full hover:bg-elevated-hi transition-colors"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="size-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  aria-hidden
                >
                  <path d="M6 6l12 12M18 6l-12 12" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Links */}
            <nav
              aria-label="Mobile primary"
              className="flex-1 flex flex-col justify-center px-6 gap-2"
            >
              <ul className="flex flex-col gap-1">
                {links.map((l, i) => (
                  <motion.li
                    key={l.href}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      delay: 0.08 + i * 0.05,
                      duration: 0.4,
                      ease: [0.2, 0.8, 0.2, 1],
                    }}
                  >
                    <a
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className="block py-3 font-display font-semibold text-5xl tracking-tight text-text hover:text-lime focus:outline-none focus-visible:text-lime transition-colors"
                    >
                      <span className="font-mono text-xs uppercase tracking-widest text-muted mr-3 align-middle">
                        0{i + 1}
                      </span>
                      {l.label}
                    </a>
                  </motion.li>
                ))}
              </ul>
            </nav>

            {/* Footer of overlay */}
            <div className="px-6 pb-8 pt-6 border-t border-line/40 flex flex-col gap-5">
              <a
                href={`mailto:${email}`}
                className="link-underline font-mono text-sm"
                onClick={() => setOpen(false)}
              >
                {email}
              </a>
              <ul className="flex flex-wrap gap-3">
                {socials.map((s) => (
                  <li key={s.label}>
                    <a
                      href={s.href}
                      target={s.href.startsWith('http') ? '_blank' : undefined}
                      rel={
                        s.href.startsWith('http')
                          ? 'noopener noreferrer'
                          : undefined
                      }
                      onClick={() => setOpen(false)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line/80 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-text/80 hover:text-lime hover:border-lime transition-colors"
                    >
                      {s.label} ↗
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Burger({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <motion.line
        x1="4"
        y1="8"
        x2="20"
        y2="8"
        animate={open ? { x1: 6, y1: 6, x2: 18, y2: 18 } : { x1: 4, y1: 8, x2: 20, y2: 8 }}
        transition={{ duration: 0.25 }}
        strokeLinecap="round"
      />
      <motion.line
        x1="4"
        y1="16"
        x2="20"
        y2="16"
        animate={open ? { x1: 6, y1: 18, x2: 18, y2: 6 } : { x1: 4, y1: 16, x2: 20, y2: 16 }}
        transition={{ duration: 0.25 }}
        strokeLinecap="round"
      />
    </svg>
  );
}
