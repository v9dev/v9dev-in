import { type Cluster, type Skill, clusters, skills, skillsByCluster } from '@content/skills';
import { useMemo } from 'react';

interface Props {
  /** A cluster id to filter to, or null for every cluster. */
  cluster: string | null;
}

// Years are capped at 5 everywhere on the site, so a full bar is 5 years.
const YEARS_CAP = 5;
// Fallback width (%) for a skill with no `years` so the stub is still visible
// (and the label reads "n/a" rather than ever rendering "NaN%").
const STUB_WIDTH = 6;

/**
 * Compute a bar's fill width and right-hand label for a skill. `years` is
 * clamped to YEARS_CAP; a missing `years` yields a min-width stub labelled
 * "n/a" so the width is never NaN.
 */
function bar(skill: Skill): { width: number; label: string } {
  if (skill.years == null) return { width: STUB_WIDTH, label: 'n/a' };
  const years = Math.min(skill.years, YEARS_CAP);
  return { width: (years / YEARS_CAP) * 100, label: `${years}y` };
}

/**
 * Hand-rolled bar chart (no chart library) for the `skills` command. Bars are
 * grouped by cluster, filled with each skill's brand hex; `font-mono`, lime
 * accents, Tailwind theme tokens throughout. Reduced-motion-safe by
 * construction: nothing animates (widths are static inline styles, not
 * transitioned classes).
 */
export default function SkillsChart({ cluster }: Props) {
  // Which cluster keys to render. A valid `cluster` filters to that one; an
  // unknown or null cluster shows every cluster in `clusters` declaration order.
  const clusterKeys = useMemo<Cluster[]>(() => {
    const all = Object.keys(clusters) as Cluster[];
    if (cluster && (cluster as Cluster) in clusters) return [cluster as Cluster];
    return all;
  }, [cluster]);

  const unknownCluster = cluster != null && !((cluster as Cluster) in clusters);

  return (
    <div className="flex flex-col gap-5 font-mono text-[12px]">
      <div className="flex items-center justify-between gap-3">
        <span className="text-lime">skills{cluster ? ` ${cluster}` : ''}</span>
        <span className="text-[10px] uppercase tracking-widest text-muted">
          years (capped at {YEARS_CAP})
        </span>
      </div>

      {unknownCluster ? (
        <p className="text-fuchsia">
          ! unknown cluster: {cluster} - try one of{' '}
          {(Object.keys(clusters) as Cluster[]).join(', ')}
        </p>
      ) : (
        clusterKeys.map((key) => {
          const list = skillsByCluster[key] ?? [];
          if (list.length === 0) return null;
          return (
            <section key={key}>
              <h3 className="mb-2 text-[10px] uppercase tracking-widest text-muted">
                {clusters[key].label}
              </h3>
              <ul className="flex flex-col gap-1.5">
                {list.map((skill) => {
                  const { width, label } = bar(skill);
                  return (
                    <li key={skill.id} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 truncate text-text" title={skill.name}>
                        {skill.name}
                      </span>
                      <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-line/40">
                        <span
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{ width: `${width}%`, backgroundColor: skill.brand }}
                        />
                      </span>
                      <span className="w-9 shrink-0 text-right text-[10px] text-muted">
                        {label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}

      <p className="text-[10px] text-muted">
        {skills.length} skills · type 'skills &lt;cluster&gt;' to filter
      </p>
    </div>
  );
}
