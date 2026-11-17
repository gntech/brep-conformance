import { describe, expect, it } from 'vitest'
import { parseOperations } from '@/pages/operations/spec'
import { readFileSync } from 'node:fs'
import { API_MD, docParts } from './source'

const parts = docParts()

// The parameter names of a signature, `f(a: A, b: list<{x: X, y: Y}>) -> R` giving a and b.
function params(sig: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const c of sig.slice(sig.indexOf('(') + 1)) {
    if ('(<{['.includes(c)) depth++
    if (')>}]'.includes(c)) depth--
    if (depth < 0 || (depth === 0 && c === ',')) {
      out.push(cur.split(':')[0]!.trim())
      cur = ''
      if (depth < 0) break
    } else cur += c
  }
  return out.filter(Boolean)
}
const ids = parts.flatMap(p => [
  p.id,
  ...p.groups.flatMap(g => [g.id, ...g.entries.map(e => e.id)]),
])

describe('the docs page', () => {
  it('gives every heading its own id, as the links into it name them', () => {
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of [
      'introduction-where-to-look',
      'calling-a-kernel',
      'box',
      'refusals',
      'the-contract-tolerance',
      'result-files-tests-and-case-ids',
      'process-adding-a-function',
    ])
      expect(ids).toContain(id)
  })

  it('has a call for every function, naming its fields', () => {
    const spec = parseOperations(readFileSync(API_MD, 'utf8'))
    const entries = parts.flatMap(p => p.groups.flatMap(g => g.entries)).filter(e => e.fn)
    expect(entries.map(e => e.heading).sort()).toEqual(spec.operations.map(o => o.id).sort())
    for (const e of entries) {
      expect(e.example, e.heading).not.toBeNull()
      const req = JSON.parse(e.example!.request) as Record<string, unknown>
      expect(req.cmd).toBe(e.heading)
      const op = spec.operations.find(o => o.id === e.heading)!
      const fields = new Set(op.signatures.flatMap(params))
      for (const k of Object.keys(req).filter(k => k !== 'cmd'))
        expect(fields, `${e.heading}.${k}`).toContain(k)
    }
  })
})
