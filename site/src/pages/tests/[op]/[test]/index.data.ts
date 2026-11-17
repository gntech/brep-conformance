import { site } from '@/data/source'
import { readDoc } from '@/docs/source'
import {
  assetUrl,
  type CaseRow,
  type Check,
  type Failure,
  type Grade,
  type Kind,
  type Report,
  type TestEntry,
} from '@/data/results'
import type { PageEntry } from '@/site/page'
import { clausesOf, definitionOf, KIND_TEXT, type Definition } from './definition'

// The failing points a page carries per check; the sample synthesizes at most a dozen.
const MAX_POINTS = 64

export interface CheckView extends Check {
  promise: string
}

// One case a kernel failed: its checks, and the files of its expected shape.
export interface CaseView {
  id: string
  glb: string
  // Null when the suite cannot write the case's shape as exact STEP.
  step: string | null
  checks: CheckView[]
}

// One case of the test: its expected shape's files, and each kernel's grade on it in `kernels`
// order, null where a kernel's report has no such case.
export interface CaseOption {
  id: string
  glb: string
  step: string | null
  grades: (Grade | null)[]
}

export interface KernelView {
  kernel: string
  version: string
  suite: string
  grade: Grade
  why: string
  failure: Failure | null
  passing: number
  total: number
  // The kernel's worst case, when it is not a pass.
  worst: CaseView | null
}

export interface Props {
  test: string
  slug: string
  operation: string
  kind: Kind
  kindText: string
  definition: Definition | null
  cases: number
  // The test's first case: the shape shown when no kernel's case is.
  shape: { id: string; glb: string; step: string | null }
  kernels: KernelView[]
  caseList: CaseOption[]
}

let docs: { clauses: Record<string, string>; api: string } | undefined
const specs = () =>
  (docs ??= { clauses: clausesOf(readDoc('contract.md')), api: readDoc('api.md') })

function caseView(c: CaseRow, base: string): CaseView {
  return {
    id: c.id,
    glb: assetUrl(base, c.test, c.id, c.asset, 'glb'),
    step: c.assetStep ? assetUrl(base, c.test, c.id, c.asset, 'step') : null,
    checks: c.checks.map(k => ({
      ...k,
      promise: specs().clauses[k.clause] ?? '',
      points: k.points.slice(0, MAX_POINTS),
    })),
  }
}

export function propsOf(t: TestEntry, latest: Report[]): Props {
  const base = latest[0]?.methodology.assetBase ?? ''
  const first = latest.flatMap(r => r.cases).find(c => c.id === t.cases[0])
  const kernels: KernelView[] = []
  const rowsOf: Map<string, CaseRow>[] = []
  for (const r of latest) {
    const k = t.kernels[r.identity.kernel]
    if (!k) continue
    const rows = r.cases.filter(c => c.operation === t.operation && c.slug === t.slug)
    rowsOf.push(new Map(rows.map(c => [c.id, c])))
    const worst = rows.find(c => c.grade === k.grade)
    kernels.push({
      kernel: r.identity.kernel,
      version: r.identity.version,
      suite: r.methodology.suite,
      grade: k.grade,
      why: k.why,
      failure: k.failure,
      passing: k.summary.passing,
      total: k.summary.total,
      worst: worst && worst.grade !== '1e-7' ? caseView(worst, base) : null,
    })
  }
  const caseList = t.cases.flatMap((id): CaseOption[] => {
    const any = rowsOf.map(rows => rows.get(id)).find(Boolean)
    if (!any) return []
    return [
      {
        id,
        glb: assetUrl(base, any.test, id, any.asset, 'glb'),
        step: any.assetStep ? assetUrl(base, any.test, id, any.asset, 'step') : null,
        grades: rowsOf.map(rows => rows.get(id)?.grade ?? null),
      },
    ]
  })
  return {
    test: t.test,
    slug: t.slug,
    operation: t.operation,
    kind: t.kind,
    kindText: KIND_TEXT[t.kind],
    definition: definitionOf(t.operation, specs().api),
    cases: t.cases.length,
    shape: {
      id: first?.id ?? t.cases[0] ?? '',
      glb: first ? assetUrl(base, first.test, first.id, first.asset, 'glb') : '',
      step: first?.assetStep ? assetUrl(base, first.test, first.id, first.asset, 'step') : null,
    },
    kernels,
    caseList,
  }
}

export function entries(): PageEntry<Props>[] {
  const s = site()
  return s.tests.map(t => ({
    params: { op: t.operation, test: t.slug },
    props: propsOf(t, s.latest),
    title: t.test,
    description: `${t.test}: its definition, checks and each kernel's result on it.`,
  }))
}
