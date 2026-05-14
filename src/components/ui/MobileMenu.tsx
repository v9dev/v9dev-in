import { useEffect, useState } from 'react';
import type Lenis from 'lenis';

interface Props {
  links: { label: string; href: string }[];
  socials: { label: string; href: string }[];
  email: string;
}

/**
 * Plain mobile nav: hamburger button -> dimmed backdrop + solid side drawer.
 * No Motion / AnimatePresence — pure CSS transitions to keep the
 * panel opaque at every frame.
 */
export default function MobileMenu({ links, socials, email }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Render the overlay continuously once first opened so CSS transitions work
  // on close as well. Track explicit mount state.
  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  // Lock page scroll while open
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

  // Esc + close-on-resize
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const mql = window.matchMedia('(min-width: 768px)');
    const onChange = () => mql.matches && setOpen(false);
    window.addEventListener('keydown', onKey);
    mql.addEventListener('change', onChange);
    return () => {
      window.removeEventListener('keydown', onKey);
      mql.removeEventListener('change', onChange);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        aria-controls="mobile-drawer"
        onClick={() => setOpen((o) => !o)}
        className="md:hidden inline-flex items-center justify-center size-9 rounded-full hover:bg-elevated-hi transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-lime"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden
        >
          {open ? (
            <path d="M6 6l12 12M18 6l-12 12" strokeLinecap="round" />
          ) : (
            <>
              <path d="M4 8h16" strokeLinecap="round" />
              <path d="M4 16h16" strokeLinecap="round" />
            </>
          )}
        </svg>
      </button>

      {mounted && (
        <div
          className="md:hidden fixed inset-0 z-[200]"
          aria-hidden={!open}
          style={{ pointerEvents: open ? 'auto' : 'none' }}
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-pointer transition-opacity duration-200"
            style={{
              background: 'rgba(0,0,0,0.6)',
              opacity: open ? 1 : 0,
            }}
          />

          {/* Drawer (solid, opaque) */}
          <aside
            id="mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
            className="absolute top-0 right-0 h-full w-[82vw] max-w-[20rem] flex flex-col transition-transform duration-300 ease-out"
            style={{
              background: '#14141c',
              borderLeft: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '-20px 0 60px -10px rgba(0,0,0,0.7)',
              transform: open ? 'translateX(0)' : 'translateX(100%)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 h-16 shrink-0"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
            >
              <a
                href="#hero"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-2"
                aria-label="Back to top"
              >
                <span
                  className="inline-block size-2 rounded-full"
                  style={{
                    background: '#b8ff3a',
                    boxShadow: '0 0 10px #b8ff3a',
                  }}
                  aria-hidden
                />
                <span className="font-mono uppercase text-xs tracking-widest text-text">
                  v9dev
                </span>
              </a>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center size-9 rounded-full hover:bg-elevated-hi transition-colors text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-lime"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="size-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden
                >
                  <path d="M6 6l12 12M18 6l-12 12" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Link list */}
            <nav
              aria-label="Mobile primary"
              className="flex-1 overflow-y-auto px-5 py-4"
            >
              <ul>
                {links.map((l, i) => (
                  <li
                    key={l.href}
                    style={{
                      borderBottom:
                        i < links.length - 1
                          ? '1px solid rgba(255,255,255,0.06)'
                          : 'none',
                    }}
                  >
                    <a
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className="block py-4 text-base font-medium text-text hover:text-lime focus:outline-none focus-visible:text-lime transition-colors"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>

              <a
                href="#contact"
                onClick={() => setOpen(false)}
                className="mt-6 inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition-colors"
                style={{ background: '#b8ff3a', color: '#0a0a0f' }}
              >
                Book a call →
              </a>
            </nav>

            {/* Footer */}
            <div
              className="px-5 py-5 shrink-0"
              style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
            >
              <a
                href={`mailto:${email}`}
                onClick={() => setOpen(false)}
                className="block font-mono text-sm text-text hover:text-lime transition-colors mb-3"
              >
                {email}
              </a>
              <ul className="flex flex-wrap gap-x-4 gap-y-2">
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
                      className="font-mono text-xs uppercase tracking-widest text-muted hover:text-lime transition-colors"
                    >
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
