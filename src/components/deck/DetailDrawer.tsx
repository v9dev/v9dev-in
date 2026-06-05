import type { ArchNode } from '@content/architectures';
import { cn } from '@lib/cn';
import { useEffect } from 'react';
import { Sheet, SheetContent, SheetTitle } from '../ui/sheet';

interface Props {
  /** The selected node, or null when nothing is selected. */
  node: ArchNode | null;
  /** Whether the drawer is open (derived from selectedNodeId != null). */
  open: boolean;
  /** Close the drawer (dispatches SELECT_NODE(null) in Deck). */
  onClose: () => void;
}

// Minimal structural shape of the Lenis singleton exposed on window by
// SmoothScroll. We only need to pause/resume it around the drawer so Radix's
// body scroll-lock is not fought by the global smooth-scroll rAF.
type LenisLike = { stop: () => void; start: () => void };
const getLenis = (): LenisLike | undefined =>
  (window as unknown as { __lenis?: LenisLike }).__lenis;

/**
 * Read-only node detail drawer built on the shared Radix sheet. Renders the
 * node's HLD, protocols (as chips), config (label/value rows) and - for
 * datastores - the table list. The accessible name comes from SheetTitle
 * (the node label); the close control is labelled "Close details".
 */
export default function DetailDrawer({ node, open, onClose }: Props) {
  // Pause Lenis while the drawer is open so the page behind it does not scroll
  // (Radix already locks the body, but the smooth-scroll rAF can still drive it).
  useEffect(() => {
    if (!open) return;
    getLenis()?.stop();
    return () => {
      getLenis()?.start();
    };
  }, [open]);

  const detail = node?.detail;

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <SheetContent
        side="right"
        closeLabel="Close details"
        className="w-[88vw] max-w-[24rem]"
        data-lenis-prevent
      >
        {node ? (
          <>
            <div className="border-line/40 border-b px-5 pt-5 pb-4">
              <div className="section-label mb-2 text-lime/80">
                <span>{node.kind}</span>
              </div>
              <SheetTitle className="font-display text-lg normal-case tracking-normal text-text">
                {node.label}
              </SheetTitle>
              <p className="mt-2 text-muted text-sm leading-relaxed">{node.hld}</p>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              {detail ? (
                <div className="flex flex-col gap-6">
                  {detail.protocols.length > 0 && (
                    <section>
                      <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted">
                        protocols
                      </h3>
                      <ul className="flex flex-wrap gap-2">
                        {detail.protocols.map((proto) => (
                          <li
                            key={proto}
                            className="rounded-full border border-line/80 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-text"
                          >
                            {proto}
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {detail.ports.length > 0 && (
                    <section>
                      <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted">
                        ports
                      </h3>
                      <ul className="flex flex-col gap-1.5">
                        {detail.ports.map((port) => (
                          <li
                            key={port.id}
                            className="flex items-center justify-between gap-3 font-mono text-xs"
                          >
                            <span className="text-text">{port.label}</span>
                            <span
                              className={cn(
                                'rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-widest',
                                port.dir === 'in'
                                  ? 'border-lime/50 text-lime'
                                  : 'border-line/80 text-muted',
                              )}
                            >
                              {port.dir}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {detail.config.length > 0 && (
                    <section>
                      <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted">
                        config
                      </h3>
                      <dl className="flex flex-col gap-1.5">
                        {detail.config.map((row) => (
                          <div
                            key={row.label}
                            className="flex items-center justify-between gap-3 border-line/20 border-b pb-1.5 font-mono text-xs last:border-b-0 last:pb-0"
                          >
                            <dt className="text-muted">{row.label}</dt>
                            <dd className="text-right text-text">{row.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                  )}

                  {detail.tables && detail.tables.length > 0 && (
                    <section>
                      <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted">
                        tables
                      </h3>
                      <ul className="flex flex-col gap-3">
                        {detail.tables.map((table) => (
                          <li key={table.name}>
                            <div className="font-mono text-xs text-lime">{table.name}</div>
                            {table.columns && table.columns.length > 0 && (
                              <ul className="mt-1 flex flex-wrap gap-1.5">
                                {table.columns.map((col) => (
                                  <li
                                    key={col}
                                    className="rounded border border-line/50 px-1.5 py-0.5 font-mono text-[10px] text-muted"
                                  >
                                    {col}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {detail.notes && (
                    <section>
                      <h3 className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted">
                        notes
                      </h3>
                      <p className="text-muted text-xs leading-relaxed">{detail.notes}</p>
                    </section>
                  )}
                </div>
              ) : (
                <p className="font-mono text-muted text-xs">no further detail for this node</p>
              )}
            </div>
          </>
        ) : (
          // Radix requires a Title for an accessible name even on the brief
          // empty frame between close and unmount; keep one mounted.
          <SheetTitle className="sr-only">node detail</SheetTitle>
        )}
      </SheetContent>
    </Sheet>
  );
}
