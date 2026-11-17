import { describe, expect, it } from 'vitest'
import { site } from '@/data/source'
import { shortCaseIds } from './format'
import { propsOf } from './index.data'

describe('propsOf', () => {
  const s = site()
  const pages = s.tests.map(t => propsOf(t, s.latest))

  it('names each case’s files by its test, id and asset, with STEP only where there is one', () => {
    for (const p of pages) {
      expect(p.shape.glb).toMatch(new RegExp(`/${p.test}/${p.shape.id}\\.[0-9a-f]+\\.glb$`))
      for (const k of p.kernels.filter(k => k.worst)) {
        const w = k.worst!
        expect(w.glb).toMatch(new RegExp(`/${p.test}/${w.id}\\.[0-9a-f]+\\.glb$`))
        if (w.step) expect(w.step).toBe(w.glb.replace(/\.glb$/, '.step'))
      }
    }
  })

  it('gives a kernel no worst case exactly when every case passed at 1e-7', () => {
    for (const p of pages)
      for (const k of p.kernels) expect(k.worst === null).toBe(k.grade === '1e-7')
  })

  it('lists every kernel with a report, in report order', () => {
    for (const p of pages) expect(p.kernels.map(k => k.kernel)).toEqual(s.kernels)
  })

  it('lists every case once, with a grade per kernel that agrees with the kernel’s count', () => {
    for (const p of pages) {
      expect(p.caseList.length).toBe(p.cases)
      expect(new Set(p.caseList.map(c => c.id)).size).toBe(p.cases)
      p.kernels.forEach((k, i) => {
        expect(p.caseList.filter(c => c.grades[i] === '1e-7').length).toBe(k.passing)
        if (k.worst) expect(p.caseList.find(c => c.id === k.worst!.id)?.grades[i]).toBe(k.grade)
      })
    }
  })

  it('tells a test’s cases apart by their short ids', () => {
    for (const p of pages) {
      const short = shortCaseIds(p.caseList.map(c => c.id))
      expect(new Set(short).size).toBe(short.length)
    }
  })

  it('opens every test’s path with its operation, as the page’s header link assumes', () => {
    for (const p of pages) expect(p.test.startsWith(`${p.operation}/`)).toBe(true)
  })

  it('quotes its area’s section of api.md on every page but a part’s', () => {
    for (const p of pages.filter(p => p.operation !== 'parts'))
      expect(p.definition?.signatures.length).toBeGreaterThan(0)
  })
})
