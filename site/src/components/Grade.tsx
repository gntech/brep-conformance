import type { ReactNode } from 'react'
import { GRADES, type Grade } from '@/data/results'

const LABEL: Record<Grade, string> = {
  '1e-7': '1e-7',
  '1e-6': '1e-6',
  '1e-5': '1e-5',
  '1e-3': '1e-3',
  unsupported: 'unsupported',
  refused: 'refused',
  timeout: 'timeout',
  fail: 'fail',
  crash: 'crash',
}

export function gradeLabel(grade: Grade): string {
  return LABEL[grade]
}

// The swatch alone: lidar ramp for a tier, hatch for unsupported, a red × for fail and crash, an
// empty hairline square for refused and timeout.
export function GradeMark({ grade, title }: { grade: Grade; title?: string }) {
  const hatch = grade === 'unsupported' ? ' sc-hatch sc-hatch' : ''
  return (
    <span
      className={`bc-mark${hatch}`}
      data-grade={grade}
      role="img"
      aria-label={title ?? LABEL[grade]}
      title={title ?? LABEL[grade]}
    />
  )
}

// The swatch and its word. Red type for fail and crash; quiet ink for the outcomes that ran no
// check.
export function GradeLabel({ grade, children }: { grade: Grade; children?: ReactNode }) {
  return (
    <span className="bc-grade" data-grade={grade}>
      <GradeMark grade={grade} />
      {children ?? LABEL[grade]}
    </span>
  )
}

// The grades that draw with one mark share an entry, so a legend never names two things for one
// symbol.
const SHARES_MARK_WITH: Partial<Record<Grade, Grade>> = { timeout: 'refused', crash: 'fail' }

// The grades given, those that share a mark gathered under the first of them.
export function markGroups(grades: readonly Grade[] = GRADES): Grade[][] {
  return grades
    .filter(g => !grades.includes(SHARES_MARK_WITH[g]!))
    .map(g => [g, ...grades.filter(o => SHARES_MARK_WITH[o] === g)])
}

export function groupLabel(group: readonly Grade[]): string {
  return group.map(g => LABEL[g]).join(' or ')
}

// `marks="table"` keys a table's marks, the × for a failure; the default keys a bar's.
export function GradeLegend({
  grades = GRADES,
  marks = 'bar',
}: {
  grades?: readonly Grade[]
  marks?: 'bar' | 'table'
}) {
  return (
    <div className={`bc-legend${marks === 'table' ? ' bc-legend--table' : ''}`}>
      {markGroups(grades).map(group => (
        <GradeLabel key={group[0]} grade={group[0]!}>
          {groupLabel(group)}
        </GradeLabel>
      ))}
    </div>
  )
}
