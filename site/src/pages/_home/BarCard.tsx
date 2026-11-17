import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { fmt, GradeMark, groupLabel, markGroups } from '@/components'
import { GRADES, type Grade } from '@/data/results'
import type { Counts } from './model'

// Keyed by the first grade of each group that shares a mark.
const MEANING: Partial<Record<Grade, string>> = {
  '1e-7': 'every check held at 1e-7 mm',
  '1e-6': 'held at 1e-6 mm, not at 1e-7',
  '1e-5': 'held at 1e-5 mm, not tighter',
  '1e-3': 'held at 1e-3 mm, not tighter',
  unsupported: 'needs an operation the kernel does not offer',
  refused: 'an operation declined, or was still running at the time limit',
  fail: 'a check held at no tier, or an operation crashed',
}

const GAP = 8
const EDGE = 16

interface Place {
  left: number
  top: number
  // Below the bar unless the card would run off the bottom of the window.
  above: boolean
  anchor: DOMRect
}

// The bar's counts as a card on hover, or on focus of one of its links, that grade marked. It is
// fixed to the window, since the leaderboard scrolls sideways and would clip a card inside it. Each
// link's own label carries its counts, so the card is for the eye only.
export function BarCard({
  title,
  counts,
  children,
}: {
  title: string
  counts: Counts
  children: ReactNode
}) {
  const [place, setPlace] = useState<Place | null>(null)
  const [grade, setGrade] = useState<Grade | null>(null)
  const card = useRef<HTMLDivElement>(null)
  const total = counts.reduce((a, b) => a + b, 0)

  const open = (el: HTMLElement) => {
    const anchor = el.getBoundingClientRect()
    setPlace({ left: anchor.left, top: anchor.bottom + GAP, above: false, anchor })
  }

  useLayoutEffect(() => {
    if (!place || !card.current) return
    const { width, height } = card.current.getBoundingClientRect()
    const left = Math.max(EDGE, Math.min(place.left, window.innerWidth - width - EDGE))
    const above = place.anchor.bottom + GAP + height > window.innerHeight - EDGE
    const top = above ? place.anchor.top - GAP - height : place.anchor.bottom + GAP
    if (left !== place.left || above !== place.above || top !== place.top)
      setPlace({ ...place, left, top, above })
  }, [place])

  useEffect(() => {
    if (!place) return
    const close = () => setPlace(null)
    window.addEventListener('scroll', close, { capture: true, passive: true })
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, { capture: true })
      window.removeEventListener('resize', close)
    }
  }, [place])

  return (
    <span
      className="hm-barcard"
      onMouseEnter={e => open(e.currentTarget)}
      onMouseLeave={() => {
        setPlace(null)
        setGrade(null)
      }}
      onMouseOver={e => {
        const g = (e.target as HTMLElement).closest<HTMLElement>('[data-grade]')?.dataset.grade
        setGrade((g as Grade | undefined) ?? null)
      }}
      onFocus={e => {
        open(e.currentTarget)
        setGrade(((e.target as HTMLElement).dataset.grade as Grade | undefined) ?? null)
      }}
      onBlur={e => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPlace(null)
      }}
    >
      {children}
      {place && (
        <div
          ref={card}
          className="hm-barcard__card"
          aria-hidden="true"
          style={{ left: place.left, top: place.top }}
        >
          <div className="hm-barcard__head">
            <span>{title}</span>
            <span>{total.toLocaleString('en-US')} cases</span>
          </div>
          <table>
            <tbody>
              {markGroups().map(group => {
                const n = group.reduce((sum, g) => sum + counts[GRADES.indexOf(g)]!, 0)
                if (!n) return null
                const on = grade !== null && group.includes(grade)
                return (
                  <tr key={group[0]} className={on ? 'hm-barcard__on' : undefined}>
                    <td>
                      <GradeMark grade={group[0]!} />
                    </td>
                    <td className="hm-barcard__grade">{groupLabel(group)}</td>
                    <td className="hm-barcard__num">{n.toLocaleString('en-US')}</td>
                    <td className="hm-barcard__num">{fmt.pct(n / total)}</td>
                    <td className="hm-barcard__why">{MEANING[group[0]!]}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="hm-barcard__foot">Click a part of the bar to list its cases</div>
        </div>
      )}
    </span>
  )
}
