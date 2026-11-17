import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { OutlineButton } from '@/ds'
import { OutlineField } from '@/ds'
import { Segmented } from '@/ds'
import { Select } from '@/ds'
import { fmt, GradeLabel, GradeMark, gradeLabel, Table, type Column } from '@/components'
import { GRADES, KINDS } from '@/data/results'
import { url } from '@/site/href'
import {
  filterToSearch,
  groupByTest,
  isUnfiltered,
  matches,
  NO_FILTER,
  sameFilter,
  shortCase,
  sortRows,
  type Filter,
  type Group,
  type Row,
  type SortDir,
  type SortKey,
} from './cases'

const PAGE_SIZE = 50

const ORDERS: { id: string; label: string; key: SortKey; dir: SortDir }[] = [
  { id: 'order', label: 'report order', key: 'order', dir: 'asc' },
  { id: 'worst', label: 'worst grade first', key: 'grade', dir: 'desc' },
  { id: 'slowest', label: 'slowest first', key: 'time', dir: 'desc' },
  { id: 'test', label: 'test name', key: 'test', dir: 'asc' },
]

// A report's cases, gathered by test: a test is one row saying what its cases came to and why, and
// opens to the cases themselves. Most of a test's cases share one reason, which is then said once.
export function CaseTable({
  rows,
  kernel,
  filter,
  opening,
  onFilter,
}: {
  rows: Row[]
  kernel: string
  filter: Filter
  // The view the report opens on.
  opening: Filter
  onFilter: (f: Filter) => void
}) {
  const [order, setOrder] = useState('order')
  // The page belongs to one view: a filter or an order changed anywhere, in this table or outside
  // it, starts the new view at its first page.
  const view = `${filterToSearch(filter)}|${order}`
  const [paged, setPaged] = useState({ view, page: 0 })
  const page = paged.view === view ? paged.page : 0
  const setPage = (n: number) => setPaged({ view, page: n })
  const [open, setOpen] = useState<Record<string, boolean>>({})

  const counts = useMemo(() => {
    const grade = new Map<string, number>()
    const operation = new Map<string, number>()
    for (const r of rows) {
      grade.set(r.grade, (grade.get(r.grade) ?? 0) + 1)
      operation.set(r.operation, (operation.get(r.operation) ?? 0) + 1)
    }
    return { grade, operation }
  }, [rows])

  const { shown, groups } = useMemo(() => {
    const by = ORDERS.find(o => o.id === order) ?? ORDERS[0]!
    const shown = sortRows(
      rows.filter(r => matches(r, filter)),
      by.key,
      by.dir,
    )
    return { shown, groups: groupByTest(shown, rows) }
  }, [rows, filter, order])

  const pages = Math.max(1, Math.ceil(groups.length / PAGE_SIZE))
  const at = Math.min(page, pages - 1)
  const slice = groups.slice(at * PAGE_SIZE, (at + 1) * PAGE_SIZE)

  const set = (patch: Partial<Filter>) => onFilter({ ...filter, ...patch })

  const short = rows.length - (counts.grade.get('1e-7') ?? 0)
  const gradeOptions = [
    { id: 'all', label: 'all grades', meta: String(rows.length) },
    { id: 'below', label: 'not 1e-7', meta: String(short) },
    ...GRADES.filter(g => counts.grade.has(g)).map(g => ({
      id: g,
      label: g,
      meta: String(counts.grade.get(g)),
    })),
  ]
  const opOptions = [
    { id: 'all', label: 'all areas', meta: String(rows.length) },
    ...[...counts.operation]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([op, n]) => ({ id: op, label: op, meta: String(n) })),
  ]

  const atOpening = sameFilter(filter, opening)
  const pager = (where: string) =>
    pages > 1 && (
      <nav className="rp-pager" aria-label={`test pages, ${where} the list`}>
        <OutlineButton size="sm" disabled={at === 0} onClick={() => setPage(at - 1)}>
          previous
        </OutlineButton>
        <span className="bc-machine">
          tests {at * PAGE_SIZE + 1}–{at * PAGE_SIZE + slice.length} of {groups.length}
        </span>
        <OutlineButton size="sm" disabled={at >= pages - 1} onClick={() => setPage(at + 1)}>
          next
        </OutlineButton>
      </nav>
    )

  return (
    <div>
      <div className="rp-filters" role="search" aria-label="filter cases">
        <div className="rp-filters__q">
          <OutlineField
            id="rp-q"
            label="search"
            type="search"
            placeholder="test, case or reason"
            value={filter.q}
            onChange={e => set({ q: e.target.value })}
          />
        </div>
        <Select
          id="rp-grade"
          label="grade"
          options={gradeOptions}
          value={filter.grade}
          onChange={id => set({ grade: id as Filter['grade'] })}
        />
        <Select
          id="rp-op"
          label="area"
          options={opOptions}
          value={filter.operation}
          onChange={id => set({ operation: id })}
        />
        <Select
          id="rp-order"
          label="order"
          options={ORDERS.map(o => ({ id: o.id, label: o.label }))}
          value={order}
          onChange={setOrder}
        />
        <div className="rp-filters__kind">
          <span className="rp-filters__label">kind</span>
          <Segmented
            label="kind"
            options={['all', ...KINDS]}
            value={filter.kind}
            onChange={id => set({ kind: id as Filter['kind'] })}
          />
        </div>
      </div>
      <div className="rp-count" aria-live="polite">
        <span className="bc-machine">
          {groups.length} {groups.length === 1 ? 'test' : 'tests'} ·{' '}
          {shown.length === rows.length
            ? `${rows.length} cases`
            : `${shown.length} of ${rows.length} cases`}
        </span>
        {filter.test !== 'all' && (
          <span className="rp-only">
            <span className="bc-annot">test</span>
            <span className="bc-machine">{filter.test}</span>
            <button
              type="button"
              className="rp-clear sc-focus"
              aria-label="show every test"
              onClick={() => set({ test: 'all' })}
            >
              ×
            </button>
          </span>
        )}
        {atOpening && !isUnfiltered(filter) && (
          <button type="button" className="rp-clear sc-focus" onClick={() => set(NO_FILTER)}>
            show all {rows.length} cases
          </button>
        )}
        {!atOpening && !isUnfiltered(filter) && (
          <button type="button" className="rp-clear sc-focus" onClick={() => set(NO_FILTER)}>
            clear filters
          </button>
        )}
        {!atOpening && isUnfiltered(filter) && short > 0 && (
          <button type="button" className="rp-clear sc-focus" onClick={() => set(opening)}>
            show only the {short} short of 1e-7
          </button>
        )}
        {pager('above')}
      </div>
      <div className="rp-groups">
        <div className="rp-group__head" aria-hidden="true">
          <span>test</span>
          <span>cases</span>
          <span>result</span>
          <span>why</span>
          <span>median time</span>
        </div>
        {slice.map(g => (
          <TestGroup
            key={g.test}
            group={g}
            kernel={kernel}
            open={open[g.test] ?? groups.length === 1}
            onToggle={v => setOpen(o => ({ ...o, [g.test]: v }))}
          />
        ))}
        {groups.length === 0 && (
          <p className="bc-annot rp-groups__empty">no case matches these filters</p>
        )}
      </div>
      {pager('below')}
    </div>
  )
}

function TestGroup({
  group: g,
  kernel,
  open,
  onToggle,
}: {
  group: Group
  kernel: string
  open: boolean
  onToggle: (open: boolean) => void
}) {
  const test = url.test(g.operation, g.slug)
  // One reason every shown case shares is the group's own line; anything else needs the column:
  // several reasons, or one that only some of the cases give.
  const perCase = g.whys.length > 1 || (g.whys.length === 1 && g.reasoned < g.rows.length)
  // A test opened before the page's script ran is open in the document and not yet in its state.
  const details = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    if (details.current && details.current.open !== open) onToggle(details.current.open)
  }, [])
  const columns: Column<Row>[] = [
    {
      key: 'id',
      label: 'case',
      sortable: false,
      render: r => (
        <a
          className="rp-case"
          href={`${test}#kernel=${encodeURIComponent(kernel)}&case=${encodeURIComponent(r.id)}`}
          title={`${r.id} on the test’s page`}
        >
          {shortCase(r.id)}
        </a>
      ),
    },
    {
      key: 'kind',
      label: 'kind',
      sortable: false,
      render: r => <span className="rp-cell">{r.kind}</span>,
    },
    {
      key: 'grade',
      label: 'grade',
      sortable: false,
      render: r => (
        <span title={r.why || undefined}>
          <GradeLabel grade={r.grade} />
        </span>
      ),
    },
    // One reason shared by every case shown is the group's own line, not a column of repeats.
    ...(perCase
      ? [
          {
            key: 'why',
            label: 'why',
            sortable: false,
            render: (r: Row) => <span className="rp-why">{fmt.condense(r.why)}</span>,
          },
        ]
      : []),
    {
      key: 'time',
      label: 'time',
      align: 'right',
      sortable: false,
      render: r => <span className="rp-cell rp-num">{fmt.ms(r.timeMs)}</span>,
    },
  ]
  return (
    <details
      ref={details}
      className="rp-group"
      open={open}
      onToggle={e => {
        const v = (e.currentTarget as HTMLDetailsElement).open
        if (v !== open) onToggle(v)
      }}
    >
      <summary className="rp-group__row">
        <span className="rp-group__test">
          <Breakable path={g.test} />
        </span>
        <span className="rp-cell rp-num">
          <span className="bc-sr">cases </span>
          {g.rows.length === g.total ? g.total : `${g.rows.length} of ${g.total}`}
        </span>
        <span className="rp-group__grades">
          <span className="bc-sr">result </span>
          {g.grades.map(([grade, n]) => (
            <span key={grade} className="rp-group__grade" title={`${n} ${gradeLabel(grade)}`}>
              <GradeMark grade={grade} title={gradeLabel(grade)} />
              {n} {grade === '1e-7' ? '' : gradeLabel(grade)}
            </span>
          ))}
        </span>
        <span className="rp-why">
          {g.whys.length > 0 && <span className="bc-sr">why </span>}
          {fmt.condense(g.whys[0] ?? '')}
          {g.whys.length > 1 && (
            <span className="bc-annot"> +{g.whys.length - 1} other reasons</span>
          )}
          {g.whys.length === 1 && g.reasoned < g.rows.length && (
            <span className="bc-annot">
              {' '}
              · {g.reasoned} of {g.rows.length} cases
            </span>
          )}
        </span>
        <span className="rp-cell rp-num">
          <span className="bc-sr">median time </span>
          {fmt.ms(g.medianMs)}
        </span>
      </summary>
      {open && (
        <div className="rp-group__cases">
          <a className="rp-group__link" href={test}>
            {g.test} on its own page
          </a>
          <div className="rp-table">
            <Table<Row>
              aria-label={`cases of ${g.test}`}
              rowKey="id"
              sortBy={null}
              rows={g.rows}
              columns={columns}
            />
          </div>
        </div>
      )}
    </details>
  )
}

// A test path breaks only after a slash when the column is narrow.
function Breakable({ path }: { path: string }) {
  const parts = path.split('/')
  return parts.map((p, i) => (
    <Fragment key={i}>
      {p}
      {i < parts.length - 1 && (
        <>
          /<wbr />
        </>
      )}
    </Fragment>
  ))
}
