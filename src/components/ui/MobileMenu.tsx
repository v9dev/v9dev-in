import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from './sheet';

interface Props {
  links: { label: string; href: string }[];
  socials: { label: string; href: string }[];
  email: string;
}

/**
 * Mobile navigation built on shadcn-style Sheet (Radix Dialog under
 * the hood). Slide-in from the right, solid panel, full a11y,
 * scroll-lock handled by Radix.
 */
export default function MobileMenu({ links, socials, email }: Props) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Open menu"
          className="md:hidden inline-flex items-center justify-center size-9 rounded-full hover:bg-elevated-hi transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-lime text-text"
        >
          <Menu className="size-5" />
        </button>
      </SheetTrigger>

      <SheetContent side="right" className="md:hidden">
        {/* Header */}
        <div className="flex items-center h-16 px-5 border-b border-line/40">
          <a
            href="#hero"
            onClick={close}
            className="inline-flex items-center gap-2"
            aria-label="Back to top"
          >
            <span
              className="inline-block size-2 rounded-full bg-lime"
              style={{ boxShadow: '0 0 10px var(--color-lime)' }}
              aria-hidden
            />
            <SheetTitle asChild>
              <span className="font-mono uppercase text-xs tracking-widest text-text">
                v9dev
              </span>
            </SheetTitle>
          </a>
        </div>

        {/* Link list */}
        <nav aria-label="Mobile primary" className="flex-1 overflow-y-auto px-5 py-4">
          <ul>
            {links.map((l, i) => (
              <li
                key={l.href}
                className={
                  i < links.length - 1 ? 'border-b border-line/30' : ''
                }
              >
                <a
                  href={l.href}
                  onClick={close}
                  className="block py-4 text-base font-medium text-text hover:text-lime focus:outline-none focus-visible:text-lime transition-colors"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>

          <a
            href="#contact"
            onClick={close}
            className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-lime px-5 py-3 text-sm font-semibold text-canvas hover:bg-lime/90 transition-colors"
          >
            Book a call →
          </a>
        </nav>

        {/* Footer */}
        <div className="px-5 py-5 border-t border-line/40">
          <a
            href={`mailto:${email}`}
            onClick={close}
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
                    s.href.startsWith('http') ? 'noopener noreferrer' : undefined
                  }
                  onClick={close}
                  className="font-mono text-xs uppercase tracking-widest text-muted hover:text-lime transition-colors"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}
