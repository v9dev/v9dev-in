import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { projects, type Project } from '@content/projects';

/**
 * Horizontal scroll carousel pinned inside its own section. Vertical
 * scroll progress drives `x` translation of the inner track.
 */
export default function WorkCarousel() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  });

  // We travel the full track width minus one viewport.
  const x = useTransform(scrollYProgress, [0, 1], ['0%', '-78%']);

  return (
    <div
      ref={sectionRef}
      className="relative"
      style={{ height: `${projects.length * 90}vh` }}
    >
      <div className="sticky top-0 h-screen overflow-hidden flex items-center">
        <motion.div
          ref={trackRef}
          style={{ x }}
          className="flex gap-6 md:gap-10 px-6 md:px-16"
          data-cursor="drag"
          data-cursor-label="← drag →"
        >
          {projects.map((p) => (
            <WorkCard key={p.slug} project={p} />
          ))}
          {/* Tail spacer so last card breathes against the edge */}
          <div className="shrink-0 w-16 md:w-32" aria-hidden />
        </motion.div>
      </div>
    </div>
  );
}

function WorkCard({ project }: { project: Project }) {
  return (
    <article className="shrink-0 w-[85vw] md:w-[60vw] lg:w-[44rem] rounded-3xl border border-line/80 bg-elevated overflow-hidden flex flex-col">
      {/* Cover */}
      <div className="relative aspect-[16/10] overflow-hidden bg-canvas">
        <div
          aria-hidden
          className="absolute inset-0 opacity-60"
          style={{
            background:
              'radial-gradient(circle at 30% 40%, rgba(184,255,58,0.18), transparent 60%), radial-gradient(circle at 80% 70%, rgba(58,224,255,0.15), transparent 55%)',
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display text-4xl md:text-6xl text-text/30 font-bold tracking-tight">
            {project.title.split(' ')[0].toUpperCase()}
          </span>
        </div>
        <div className="absolute top-4 left-4 inline-flex items-center gap-2 rounded-full bg-canvas/80 backdrop-blur-md border border-line/80 px-3 py-1 font-mono text-[10px] uppercase tracking-widest">
          <span className="size-1.5 rounded-full bg-lime" aria-hidden /> {project.tag}
        </div>
        <div className="absolute top-4 right-4 font-mono text-[10px] uppercase tracking-widest text-muted">
          {project.year}
        </div>
      </div>

      {/* Body */}
      <div className="p-6 md:p-8 flex flex-col gap-4">
        <h3 className="font-display text-2xl md:text-3xl font-semibold leading-tight">
          {project.title}
        </h3>
        <p className="text-muted leading-relaxed">{project.subtitle}</p>
        <p className="font-mono text-sm text-lime">→ {project.outcome}</p>

        <div className="flex flex-wrap gap-1.5 mt-2">
          {project.stack.slice(0, 8).map((s) => (
            <span
              key={s}
              className="rounded-full bg-canvas border border-line/60 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-text/80"
            >
              {s}
            </span>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap gap-3">
          {project.links.live && (
            <a
              href={project.links.live}
              target="_blank"
              rel="noopener noreferrer"
              data-cursor-label="open"
              className="inline-flex items-center gap-1.5 rounded-full bg-text px-4 py-1.5 text-sm font-semibold text-canvas hover:bg-white"
            >
              Live ↗
            </a>
          )}
          {project.links.repo && (
            <a
              href={project.links.repo}
              target="_blank"
              rel="noopener noreferrer"
              data-cursor-label="code"
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-1.5 text-sm font-semibold hover:border-lime hover:text-lime"
            >
              Code ↗
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
