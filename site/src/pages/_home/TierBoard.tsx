import { fmt, GradeMark, KernelChip, Table } from '@/components'
import { GRADES, TIERS } from '@/data/results'
import { url } from '@/site/href'
import { BarCard } from './BarCard'
import type { BoardRow } from './model'
import { TierBar } from './TierBar'

const n = (x: number) => x.toLocaleString('en-US')

const LOOSER = TIERS.filter(t => t !== '1e-7')

function Ruler() {
  return (
    <span className="hm-ruler" aria-hidden="true">
      {[0, 25, 50, 75, 100].map(p => (
        <span key={p}>{p}%</span>
      ))}
    </span>
  )
}

function MedianTime({ r }: { r: BoardRow }) {
  if (!r.time) return <span className="bc-annot">–</span>
  return <span className="hm-rate__pct">{fmt.ms(r.time.median)}</span>
}

// Each kernel's cases split by the tightest tolerance passed; a segment's hover card lists them.
export function TierBoard({
  board,
  picked,
  onCompare,
}: {
  board: BoardRow[]
  // The kernels ticked for the grid below; null where every kernel is compared and no tick shows.
  picked: string[] | null
  onCompare: (kernel: string) => void
}) {
  return (
    <div className={`hm-board hm-board--tiers${picked ? ' hm-board--compare' : ''}`}>
      <Table<BoardRow>
        rowKey="kernel"
        sortBy="rate"
        sortDir="desc"
        rows={board}
        aria-label="Each kernel’s cases by the tightest tolerance passed"
        columns={[
          ...(picked
            ? [
                {
                  key: 'compare',
                  label: 'compare',
                  sortable: false,
                  width: 28,
                  render: (r: BoardRow) => {
                    const on = picked.includes(r.kernel)
                    return (
                      <button
                        type="button"
                        className="hm-pick sc-focus"
                        aria-pressed={on}
                        aria-label={`${on ? 'Remove' : 'Add'} ${r.kernel} ${on ? 'from' : 'to'} the comparison`}
                        onClick={() => onCompare(r.kernel)}
                      >
                        {on ? '■' : '□'}
                      </button>
                    )
                  },
                },
              ]
            : []),
          { key: 'rank', label: '#', numeric: true, align: 'right', width: 32, dim: true },
          {
            key: 'kernel',
            label: 'kernel',
            render: r => (
              <span className="hm-kernel">
                <KernelChip
                  kernel={r.kernel}
                  version={r.version}
                  href={url.report(r.suite, r.kernel, r.version)}
                />
                {r.license && (
                  <span className="hm-license">
                    {r.source ? (
                      <a href={r.source} title={`${r.kernel}’s source`}>
                        {r.license}
                      </a>
                    ) : (
                      r.license
                    )}
                    {r.maintainers && ' · made by the suite’s maintainer'}
                  </span>
                )}
              </span>
            ),
          },
          {
            key: 'rate',
            label: 'pass at 1e-7',
            numeric: true,
            align: 'right',
            render: r => (
              <span className="hm-rate">
                <span className="hm-rate__pct">{fmt.pct(r.rate)}</span>
                <span className="hm-rate__of">
                  {n(r.passing)} / {n(r.total)}
                </span>
              </span>
            ),
          },
          {
            key: 'counts',
            label: 'cases by tightest tolerance passed, mm',
            sortable: false,
            width: '26%',
            render: r => (
              <span className="hm-tiers">
                <BarCard title={`${r.kernel} ${r.version}`} counts={r.counts}>
                  <TierBar
                    counts={r.counts}
                    label={`${r.kernel}: ${r.passing} of ${r.total} cases at 1e-7`}
                    href={g => `${url.report(r.suite, r.kernel, r.version)}?grade=${g}#cases`}
                  />
                </BarCard>
                <Ruler />
              </span>
            ),
          },
          // Each looser tolerance: the share of cases that pass at it or tighter, and under it the
          // cases it adds. The shares sit within half a point of one another, so the cases gained
          // are what tells the kernels apart; a share that gains nothing is set back.
          ...LOOSER.map(tier => ({
            key: `more-${tier}`,
            label: `at ${tier}`,
            sortable: false,
            align: 'right' as const,
            width: 84,
            render: (r: BoardRow) => {
              const at = GRADES.indexOf(tier)
              const more = r.counts[at]!
              const within = r.counts.slice(0, at + 1).reduce((a, b) => a + b, 0) / r.total
              return (
                <span
                  className={`hm-rate${more ? '' : ' hm-rate--same'}`}
                  title={
                    more
                      ? `${fmt.pct(within)} of cases pass at ${tier} mm or tighter: ${more} more than at the tolerance before`
                      : `${fmt.pct(within)} of cases pass at ${tier} mm or tighter: no more than at the tolerance before`
                  }
                >
                  <span className="hm-rate__pct">{fmt.pct(within)}</span>
                  {more ? (
                    <span className="hm-more">
                      <GradeMark grade={tier} />+{n(more)}
                    </span>
                  ) : (
                    <span className="hm-more hm-more--none">–</span>
                  )}
                </span>
              )
            },
          })),
          {
            key: 'medianMs',
            label: 'median case time',
            width: 150,
            numeric: true,
            align: 'right',
            render: r => <MedianTime r={r} />,
          },
          {
            key: 'speed',
            label: 'time vs fastest',
            numeric: true,
            align: 'right',
            width: 130,
            render: r => <span className="hm-rate__pct">{fmt.factor(r.speedFactor)}</span>,
          },
        ]}
      />
    </div>
  )
}
