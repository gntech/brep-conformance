import { GRADES, type Grade } from '@/data/results'
import type { Counts } from './model'

// A share of cases per grade, best first, as one hairline-framed bar. Segments are proportional;
// the label carries the counts for anyone not reading colour.
export function TierBar({
  counts,
  label,
  thin,
  href,
}: {
  counts: Counts
  label: string
  thin?: boolean
  // Makes each segment a link, to that grade's cases; its own card then names it, not a title.
  href?: (grade: Grade) => string
}) {
  const total = counts.reduce((a, b) => a + b, 0)
  return (
    // With links it is a group of them, since an image may not hold controls.
    <span
      className={`hm-bar${thin ? ' hm-bar--thin' : ''}`}
      role={href ? 'group' : 'img'}
      aria-label={label}
    >
      {GRADES.map((g, i) =>
        !counts[i] ? null : href ? (
          <a
            key={g}
            className="hm-bar__seg"
            data-grade={g}
            href={href(g)}
            aria-label={`${g}: ${counts[i]!.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} cases, list them`}
            style={{ flexGrow: counts[i], flexBasis: 0 }}
          />
        ) : (
          <span
            key={g}
            className="hm-bar__seg"
            data-grade={g}
            style={{ flexGrow: counts[i], flexBasis: 0 }}
            title={total ? `${g}: ${counts[i]} of ${total}` : undefined}
          />
        ),
      )}
    </span>
  )
}
