import { fmt, GradeMark, PageHead, Section } from '@/components'
import { href, url } from '@/site/href'
import './operations.css'
import type { Props } from './index.data'

export const nav = { label: 'operations', order: 2 }

const FILTER_ID = 'fn-q'
const COUNT_ID = 'fn-count'

// Every operation against every kernel: a column per kernel, so a kernel reads down the page. The
// page ships no data; `enhance` filters the rows already drawn.
export default function OperationsIndex({ total, kernels, groups }: Props) {
  return (
    <>
      <PageHead title="Operations" corner={[`${total} operations`, `${kernels.length} kernels`]} />
      <Section
        label="what each kernel offers"
        aside={<a href={href('/docs/#constructors')}>how each operation is specified</a>}
      >
        <div className="fn-tools">
          <label className="bc-annot" htmlFor={FILTER_ID}>
            filter operations
          </label>
          <input
            id={FILTER_ID}
            className="fn-filter sc-focus"
            type="search"
            placeholder="an operation or a group, e.g. fillet"
            autoComplete="off"
          />
          <span className="bc-annot" id={COUNT_ID} aria-live="polite">
            {total} of {total}
          </span>
          <span className="fn-key">
            <span>
              <i className="fn-yes" /> offered
            </span>
            <span>
              <GradeMark grade="unsupported" title="not offered" /> not offered
            </span>
            <span>
              <span className="fn-standin">as revolve</span> the suite sends that operation instead
            </span>
          </span>
        </div>
        <table className="fn-table">
          <thead>
            <tr>
              <th scope="col">operation</th>
              {kernels.map(k => (
                <th key={k.kernel} scope="col" className="fn-kernel">
                  <a href={url.report(k.suite, k.kernel, k.version)}>
                    <span>{k.kernel}</span>
                  </a>
                </th>
              ))}
            </tr>
            <tr className="fn-totals">
              <th scope="row">operations offered</th>
              {kernels.map(k => (
                <td key={k.kernel}>
                  <span className="fn-pair">
                    <span className="fn-pair__n">{k.offered}</span>
                    <span className="fn-pair__of">of {total}</span>
                  </span>
                </td>
              ))}
            </tr>
          </thead>
          {groups.map(g => (
            <tbody key={g.group} data-group="">
              <tr className="fn-group">
                <th scope="rowgroup">
                  <span className="fn-cell">
                    <span className="fn-group__name">{g.group}</span>
                    {g.areas.length > 0 && (
                      <span className="bc-annot">
                        offered, and cases passed at 1e-7 on{' '}
                        {g.areas.map((a, i) => (
                          <span key={a}>
                            {i > 0 && ' and '}
                            <a href={`${url.home()}#${a}`}>{a}</a>
                          </span>
                        ))}{' '}
                        tests
                      </span>
                    )}
                  </span>
                </th>
                {g.rates.map((r, i) => (
                  <td key={kernels[i]!.kernel}>
                    <span className="fn-pair">
                      <span className="fn-pair__n">
                        {g.functions.filter(f => f.cells[i] === true).length}
                        <span className="fn-wide"> of </span>
                        <span className="fn-narrow">/</span>
                        {g.functions.length}
                      </span>
                      {r !== null && (
                        <span className="fn-pair__of">
                          <span className="fn-wide">{fmt.pct(r)} pass</span>
                          <span className="fn-narrow">{fmt.pct(r, 0)}</span>
                        </span>
                      )}
                    </span>
                  </td>
                ))}
              </tr>
              {g.functions.map(f => (
                <tr key={f.id} data-fn={`${f.id} ${g.group}`.toLowerCase()}>
                  <th scope="row">
                    <span className="fn-cell">
                      <a href={url.operation(f.id)}>{f.id}</a>
                      {f.signature && <code className="fn-sig bc-machine">{f.signature}</code>}
                    </span>
                  </th>
                  {f.cells.map((c, i) => {
                    const kernel = kernels[i]!.kernel
                    return (
                      <td key={kernel}>
                        {c === true ? (
                          <i className="fn-yes" role="img" aria-label={`${kernel} offers it`} />
                        ) : c === false ? (
                          <GradeMark grade="unsupported" title={`${kernel} does not offer it`} />
                        ) : (
                          <span
                            className="fn-standin"
                            title={`${kernel} does not offer it; the suite sends ${c} instead`}
                          >
                            as {c}
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
        <p className="bc-annot fn-none" id="fn-none" hidden>
          no operation matches
        </p>
      </Section>
    </>
  )
}

export function enhance() {
  const input = document.getElementById(FILTER_ID) as HTMLInputElement | null
  if (!input) return
  const rows = [...document.querySelectorAll<HTMLElement>('tr[data-fn]')]
  const groups = [...document.querySelectorAll<HTMLElement>('tbody[data-group]')]
  const none = document.getElementById('fn-none')
  const count = document.getElementById(COUNT_ID)
  const apply = () => {
    const words = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean)
    for (const r of rows) r.hidden = !words.every(w => r.dataset.fn!.includes(w))
    for (const g of groups) g.hidden = !g.querySelector('tr[data-fn]:not([hidden])')
    const shown = rows.filter(r => !r.hidden).length
    if (none) none.hidden = shown > 0
    if (count) count.textContent = `${shown} of ${rows.length}`
  }
  input.addEventListener('input', apply)
  apply()
}
