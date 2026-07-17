import TiltCard from '@components/ui/TiltCard.tsx';
import { type Project, projects } from '@content/projects';
import { motion, useScroll, useTransform } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const TAG_ACCENT: Record<Project['tag'], string> = {
  'Self-hosted': '#3AE0FF',
  OSS: '#B8FF3A',
  Production: '#FF3A8C',
  WIP: '#F5F5F0',
};

/**
 * Horizontal scroll carousel pinned inside its own section. Vertical
 * scroll progress drives `x` translation of the inner track.
 * Travel distance is computed dynamically from the rendered track so
 * the math stays correct when projects are added or removed.
 */
export default function WorkCarousel() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  });

  const [travel, setTravel] = useState(0);

  useLayoutEffect(() => {
    const measure = () => {
      const track = trackRef.current;
      if (!track) return;
      const total = track.scrollWidth;
      const t = Math.max(0, total - window.innerWidth);
      setTravel(t);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (trackRef.current) ro.observe(trackRef.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Section height grows with project count so the user has enough vertical
  // scroll to traverse the full carousel.
  const sectionHeight = `${Math.max(projects.length * 80, 300)}vh`;

  const x = useTransform(scrollYProgress, [0, 1], [0, -travel]);

  return (
    <div ref={sectionRef} className="relative" style={{ height: sectionHeight }}>
      <div className="sticky top-0 h-screen overflow-hidden flex items-center">
        <motion.div
          ref={trackRef}
          style={{ x }}
          className="flex gap-6 md:gap-10 px-6 md:px-16"
          data-cursor="drag"
          data-cursor-label="drag"
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
  const accent = TAG_ACCENT[project.tag];

  return (
    <TiltCard className="relative shrink-0 w-[85vw] sm:w-[70vw] md:w-[58vw] lg:w-[42rem] rounded-3xl border border-line/80 bg-elevated overflow-hidden">
      <article className="flex flex-col h-full">
        {/* Cover */}
        <div className="relative aspect-[16/10] overflow-hidden bg-canvas">
          <div
            aria-hidden
            className="absolute inset-0 opacity-60"
            style={{
              background: `radial-gradient(circle at 30% 40%, ${accent}28, transparent 60%), radial-gradient(circle at 80% 70%, ${accent}1c, transparent 55%)`,
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center px-6">
            <span
              className="font-display text-3xl sm:text-4xl md:text-6xl font-bold tracking-tight text-balance text-center"
              style={{ color: 'rgba(245,245,240,0.18)' }}
            >
              {project.title.split(',')[0].toUpperCase()}
            </span>
          </div>
          <div
            className="absolute top-4 left-4 inline-flex items-center gap-2 rounded-full bg-canvas/85 backdrop-blur-md border border-line/80 px-3 py-1 font-mono text-[10px] uppercase tracking-widest"
            style={{ color: accent }}
          >
            <span
              className="size-1.5 rounded-full"
              aria-hidden
              style={{ background: accent, boxShadow: `0 0 8px ${accent}` }}
            />
            {project.tag}
          </div>
          <div className="absolute top-4 right-4 font-mono text-[10px] uppercase tracking-widest text-muted">
            {project.year}
          </div>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 md:p-8 flex flex-col gap-4">
          <h3 className="font-display text-xl sm:text-2xl md:text-3xl font-semibold leading-tight text-balance">
            {project.title}
          </h3>
          <p className="text-muted leading-relaxed text-sm sm:text-base">{project.subtitle}</p>
          <p className="font-mono text-xs sm:text-sm" style={{ color: accent }}>
            → {project.outcome}
          </p>

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

          {project.links.repo && (
            <div className="mt-2 flex flex-wrap gap-3">
              <a
                href={project.links.repo}
                target="_blank"
                rel="noopener noreferrer"
                data-cursor-label="code"
                className="link-underline inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-text/90"
              >
                View repo ↗
              </a>
            </div>
          )}
        </div>
      </article>
    </TiltCard>
  );
}
