import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type Lenis from 'lenis';

interface LinkItem {
  label: string;
  href: string;
  /** Section index shown as a small monospace number prefix (e.g. '03'). */
  index: string;
  /** One-line subtitle below the label. */
  hint: string;
}

interface SocialItem {
  label: string;
  href: string;
}

interface Props {
  /** Links provided by the parent Nav (label/href). Section index + hint
   *  are filled in here so the menu owns its own polish. */
  links: { label: string; href: string }[];
  socials: SocialItem[];
  email: string;
}

const META: Record<string, { index: string; hint: string }> = {
  '#stack': { index: '03', hint: 'the constellation' },
  '#services': { index: '04', hint: 'how I help' },
  '#work': { index: '05', hint: 'projects I shipped' },
  '#blog': { index: '06', hint: 'short field notes' },
  '#contact': { index: '07', hint: 'send a message' },
};

const ORDER = ['#stack', '#services', '#work', '#blog', '#contact'];

export default function MobileMenu({ links, socials, email }: Props) {
  const [open, setOpen] = useState(false);

  // Order + enrich links into the menu's canonical sequence
  const items: LinkItem[] = ORDER.map((href) => {
    const orig = links.find((l) => l.href === href);
    const meta = META[href];
    return orig && meta ? { ...orig, ...meta } : null;
  }).filter((x): x is LinkItem => x !== null);

  // Scroll lock (native + Lenis)
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

  // Close on rotation/widen past md
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
            className="md:hidden fixed inset-0 z-50 flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-canvas/95 backdrop-blur-2xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setOpen(false)}
              aria-hidden
            />

            {/* Subtle drifting accent blobs (match the site's ambient feel) */}
            <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
              <div
                className="absolute -top-40 -right-40 size-[40rem] rounded-full blur-3xl opacity-[0.10]"
                style={{
                  background:
                    'radial-gradient(closest-side, var(--color-lime), transparent 70%)',
                }}
              />
              <div
                className="absolute -bottom-40 -left-40 size-[36rem] rounded-full blur-3xl opacity-[0.08]"
                style={{
                  background:
                    'radial-gradient(closest-side, var(--color-fuchsia), transparent 70%)',
                }}
              />
            </div>

            {/* Content */}
            <motion.div
              className="relative flex flex-col h-full"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
            >
              {/* Top bar */}
              <div className="flex items-center justify-between px-5 pt-5">
                <div className="section-label text-lime/80">
                  <span>Menu</span>
                </div>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-2 rounded-full border border-line/80 bg-elevated/60 backdrop-blur-md pl-3 pr-2 py-1.5 font-mono text-[10px] uppercase tracking-widest text-text/80 hover:text-text hover:border-lime/80 transition-colors"
                >
                  Close
                  <span className="inline-flex items-center justify-center size-5 rounded-full bg-elevated">
                    <svg
                      viewBox="0 0 24 24"
                      className="size-3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden
                    >
                      <path d="M6 6l12 12M18 6l-12 12" strokeLinecap="round" />
                    </svg>
                  </span>
                </button>
              </div>

              {/* Link list */}
              <nav
                aria-label="Mobile primary"
                className="flex-1 flex flex-col justify-center px-5"
              >
                <ul className="flex flex-col">
                  {items.map((l, i) => (
                    <motion.li
                      key={l.href}
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        delay: 0.08 + i * 0.05,
                        duration: 0.5,
                        ease: [0.2, 0.8, 0.2, 1],
                      }}
                      className="border-t border-line/30 last:border-b"
                    >
                      <a
                        href={l.href}
                        onClick={() => setOpen(false)}
                        className="group flex items-center gap-4 py-5 sm:py-6 focus:outline-none"
                      >
                        <span className="font-mono text-xs text-muted w-8 tabular-nums">
                          {l.index}
                        </span>
                        <span className="flex-1 flex flex-col gap-0.5">
                          <span className="font-display font-semibold text-4xl sm:text-5xl leading-[0.95] tracking-tight text-text group-hover:text-lime group-focus-visible:text-lime transition-colors">
                            {l.label}
                          </span>
                          <span className="font-mono text-[11px] uppercase tracking-widest text-muted/80">
                            {l.hint}
                          </span>
                        </span>
                        <motion.span
                          aria-hidden
                          className="font-display text-3xl text-muted group-hover:text-lime group-focus-visible:text-lime transition-colors"
                          initial={false}
                          whileHover={{ x: 6 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        >
                          →
                        </motion.span>
                      </a>
                    </motion.li>
                  ))}
                </ul>
              </nav>

              {/* Footer */}
              <motion.div
                className="px-5 pb-7 pt-5 flex flex-col gap-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45, duration: 0.4 }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted">
                    <span className="relative flex size-1.5">
                      <span className="absolute inset-0 rounded-full bg-lime animate-ping opacity-75" />
                      <span className="relative rounded-full bg-lime size-1.5" />
                    </span>
                    Available · 2026
                  </div>
                  <a
                    href={`mailto:${email}`}
                    className="link-underline font-mono text-xs sm:text-sm text-text"
                    onClick={() => setOpen(false)}
                  >
                    {email}
                  </a>
                </div>

                <ul className="grid grid-cols-2 gap-2">
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
                        className="inline-flex w-full items-center justify-between gap-2 rounded-full border border-line/80 bg-elevated/40 px-4 py-2.5 font-mono text-[11px] uppercase tracking-widest text-text/80 hover:text-lime hover:border-lime/60 transition-colors"
                      >
                        {s.label}
                        <span aria-hidden>↗</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </motion.div>
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
