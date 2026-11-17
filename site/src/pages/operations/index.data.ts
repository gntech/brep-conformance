import { site } from '@/data/source'
import type { PageEntry } from '@/site/page'
import { AREA_SECTION } from '../tests/[op]/[test]/definition'
import { operations } from './doc'

export interface KernelColumn {
  kernel: string
  version: string
  suite: string
  // How many of the functions it offers.
  offered: number
}

export interface FunctionRow {
  id: string
  signature: string | null
  // Per kernel, in `kernels` order: offered, not offered, or the function the suite sends in its
  // place.
  cells: (boolean | string)[]
}

export interface GroupRows {
  group: string
  // The test areas that exercise the group's functions. A report does not say which tests call a
  // function, so how well a kernel does is known per area and not per function.
  areas: string[]
  // Per kernel, the share of those areas' cases it passes at 1e-7; null where it ran none.
  rates: (number | null)[]
  functions: FunctionRow[]
}

export interface Props {
  total: number
  kernels: KernelColumn[]
  groups: GroupRows[]
}

export function propsOf(): Props {
  const s = site()
  const ops = operations().operations
  const kernels: KernelColumn[] = s.latest.map(r => ({
    kernel: r.identity.kernel,
    version: r.identity.version,
    suite: r.methodology.suite,
    offered: ops.filter(o => o.offeredBy.includes(r.identity.kernel)).length,
  }))
  const groups: GroupRows[] = []
  for (const o of ops) {
    let g = groups.find(x => x.group === o.doc.group)
    if (!g) {
      const areas = Object.keys(AREA_SECTION).filter(a => AREA_SECTION[a] === o.doc.group)
      const tests = s.tests.filter(t => areas.includes(t.operation))
      g = {
        group: o.doc.group,
        areas,
        rates: kernels.map(k => {
          const sums = tests.flatMap(t =>
            t.kernels[k.kernel] ? [t.kernels[k.kernel]!.summary] : [],
          )
          const total = sums.reduce((n, x) => n + x.total, 0)
          return total ? sums.reduce((n, x) => n + x.passing, 0) / total : null
        }),
        functions: [],
      }
      groups.push(g)
    }
    g.functions.push({
      id: o.id,
      signature: o.doc.signatures[0] ?? null,
      cells: kernels.map(k => {
        const support = o.kernels.find(x => x.kernel === k.kernel)
        if (!support) return false
        return support.offered ? true : (support.standIn ?? false)
      }),
    })
  }
  return { total: ops.length, kernels, groups }
}

export function entries(): PageEntry<Props>[] {
  return [
    {
      props: propsOf(),
      title: 'operations',
      description: 'Every operation the suite specifies, and which kernels offer it.',
    },
  ]
}
