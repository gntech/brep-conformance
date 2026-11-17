import { useEffect, useState } from 'react'
import { Segmented } from '@/ds'
import { Select } from '@/ds'
import { fmt } from '@/components'
import { url } from '@/site/href'
import {
  caseTitle,
  distinctFilters,
  FILTER_LABEL,
  FILTERS,
  keep,
  matchesQuery,
  passing,
  relativeTimes,
  shownShare,
  total,
  type Cell,
  type Filter,
  type GridGroup,
} from './model'
import { TierBar } from './TierBar'

const ANY_KERNEL = 'any'

// Every test against the kernels compared, one <details> per operation so it reads without JS.
// Hydrated, it adds a filter, the search, and open/close all. A cell opens that kernel's cases on
// the test.
export function Grid({
  groups,
  kernels,
  shown,
  suite,
  versions,
  q,
}: {
  groups: GridGroup[]
  kernels: string[]
  shown: string[]
  // Every kernel in the grid is on this suite version.
  suite: string
  versions: Record<string, string>
  q: string
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const [focus, setFocus] = useState(ANY_KERNEL)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [jump, setJump] = useState<string | null>(null)

  // A link to an operation (#booleans) opens its tests and brings them to the top: closed, the
  // group is one row near the page's foot, which the browser cannot scroll up to.
  useEffect(() => {
    const show = () => {
      let op: string
      try {
        op = decodeURIComponent(location.hash.slice(1))
      } catch {
        return
      }
      if (!groups.some(g => g.operation === op)) return
      setOpen(o => ({ ...o, [op]: true }))
      setJump(op)
    }
    show()
    window.addEventListener('hashchange', show)
    return () => window.removeEventListener('hashchange', show)
  }, [groups])
  // Scrolls once the group has been drawn open, when the page is tall enough to scroll to it.
  useEffect(() => {
    if (!jump) return
    document.getElementById(jump)?.scrollIntoView({ block: 'start' })
    setJump(null)
  }, [jump])
  const cols = shown.map(k => kernels.indexOf(k)).filter(i => i >= 0)
  const pick = <T,>(xs: T[]) => cols.map(i => xs[i]!)
  const scope = shown.includes(focus) ? shown.indexOf(focus) : null
  const filters = distinctFilters(
    groups.flatMap(g => g.tests.map(t => ({ ...t, cells: pick(t.cells) }))),
    scope,
  )
  const shownFilter = filters.includes(filter) ? filter : 'all'
  const searching = q.trim() !== ''
  const visible = groups
    .map(g => ({
      ...g,
      cells: pick(g.cells),
      tests: g.tests
        .filter(t => matchesQuery(t, g.operation, q))
        .map(t => ({ ...t, cells: pick(t.cells) }))
        .filter(t => keep(t, shownFilter, scope)),
    }))
    .filter(g => g.tests.length)
  const tests = visible.flatMap(g => g.tests)
  const allTests = groups.reduce((n, g) => n + g.tests.length, 0)
  const isOpen = (op: string) => open[op] ?? searching
  const setAll = (v: boolean) => setOpen(Object.fromEntries(groups.map(g => [g.operation, v])))
  const names = cols.map(i => kernels[i]!)
  const caseLink = (kernel: string, test: string) =>
    `${url.report(suite, kernel, versions[kernel]!)}?test=${encodeURIComponent(test)}#cases`

  return (
    <div className="hm-grid" style={{ ['--hm-k' as string]: names.length }}>
      <div className="hm-grid__tools">
        <span className="hm-grid__filters">
          <Select
            label="for"
            width={168}
            options={[{ id: ANY_KERNEL, label: 'any kernel' }, ...shown]}
            value={scope === null ? ANY_KERNEL : focus}
            onChange={setFocus}
          />
          <Segmented
            label="show"
            options={FILTERS.map(f => ({
              id: f,
              label: FILTER_LABEL[f],
              disabled: !filters.includes(f),
            }))}
            value={shownFilter}
            onChange={id => setFilter(id as Filter)}
          />
        </span>
        <span className="bc-annot hm-grid__count">
          showing {tests.length} of {allTests} · {names.length} of {kernels.length} kernels
          {searching && ` · matching “${q.trim()}”`}
        </span>
        <span className="hm-grid__toggle">
          <button type="button" className="sc-focus" onClick={() => setAll(true)}>
            open all
          </button>
          <button type="button" className="sc-focus" onClick={() => setAll(false)}>
            close all
          </button>
        </span>
      </div>
      <div className="hm-grid__scroll">
        <div className="hm-grid__head">
          <span className="bc-annot">area · test</span>
          {names.map(k => (
            <a
              key={k}
              className="bc-annot hm-grid__kernel"
              href={url.report(suite, k, versions[k]!)}
            >
              {k}
            </a>
          ))}
        </div>
        {visible.map(g => (
          <details
            key={g.operation}
            id={g.operation}
            className="hm-op"
            open={isOpen(g.operation)}
            onToggle={e => {
              const v = (e.currentTarget as HTMLDetailsElement).open
              if (v !== isOpen(g.operation)) setOpen(o => ({ ...o, [g.operation]: v }))
            }}
          >
            <summary className="hm-row hm-row--op">
              <span className="hm-row__name">
                <span className="hm-op__name">{g.operation}</span>
                <span className="hm-op__count">{g.tests.length}</span>
              </span>
              {g.cells.map((c, i) => (
                <span key={names[i]} className="hm-cell">
                  <Share cell={c} />
                  <TierBar
                    thin
                    counts={c?.counts ?? []}
                    label={caseTitle(names[i]!, g.operation, c)}
                  />
                </span>
              ))}
            </summary>
            {g.tests.map(t => {
              const rel = relativeTimes(t.cells)
              const timed = rel.filter(r => r !== null).length
              return (
                <div key={t.slug} className="hm-row">
                  <a className="hm-row__name hm-row__test" href={url.test(g.operation, t.slug)}>
                    {t.slug.replaceAll('-', ' ')}
                  </a>
                  {t.cells.map((c, i) => {
                    const title = caseTitle(names[i]!, t.slug, c)
                    if (!c)
                      return (
                        <span key={names[i]} className="hm-cell hm-cell--none bc-annot">
                          not run
                        </span>
                      )
                    return (
                      <a
                        key={names[i]}
                        className="hm-cell"
                        data-grade={c.grade}
                        href={caseLink(names[i]!, t.test)}
                        title={`${title} · open these cases`}
                      >
                        <Frac cell={c} />
                        <TierBar thin counts={c.counts} label={title} />
                        <Time cell={c} rel={rel[i]!} compared={timed > 1} />
                      </a>
                    )
                  })}
                </div>
              )
            })}
          </details>
        ))}
        {!visible.length && <p className="bc-annot hm-grid__empty">no test matches</p>}
      </div>
    </div>
  )
}

function Share({ cell }: { cell: Cell | null }) {
  if (!cell || !total(cell)) return null
  return (
    <span className="hm-frac bc-machine">{fmt.pct(shownShare(passing(cell), total(cell)))}</span>
  )
}

function Frac({ cell }: { cell: Cell | null }) {
  if (!cell) return null
  return (
    <span className="hm-frac bc-machine">
      {passing(cell)}/{total(cell)}
    </span>
  )
}

function Time({ cell, rel, compared }: { cell: Cell; rel: number | null; compared: boolean }) {
  // A bar with nothing passed says there is no time to give; a report rounds a time under its
  // resolution to 0, which is said as that and not as no time at all.
  if (cell.medianMs === null || !passing(cell)) return null
  if (cell.medianMs === 0) return <span className="hm-time bc-machine">&lt;0.01 ms</span>
  if (rel === null) return <span className="hm-time bc-machine">{fmt.ms(cell.medianMs)}</span>
  const best = compared && rel === 1
  return (
    <span className={`hm-time bc-machine${best ? ' hm-time--best' : ''}`}>
      {fmt.ms(cell.medianMs)}
      {compared && (
        <span className="hm-time__rel">
          <span className="hm-time__sep"> · </span>
          {best ? 'fastest' : `×${rel.toFixed(1)}`}
        </span>
      )}
    </span>
  )
}
