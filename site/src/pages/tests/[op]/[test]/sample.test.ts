import { describe, expect, it } from 'vitest'
import { box, glbOf } from './fixture'
import { parseGlb } from './glb'
import { classifier, halton, samplePoints } from './sample'

const shape = (() => {
  const b = box([2, 3, 4])
  return parseGlb(glbOf(b.positions, b.triangles))
})()

describe('halton', () => {
  it('is the radical inverse of the index', () => {
    expect([1, 2, 3, 4].map(i => halton(i, 2))).toEqual([0.5, 0.25, 0.75, 0.125])
    expect(halton(1, 3)).toBeCloseTo(1 / 3)
  })
})

describe('classifier', () => {
  const inside = classifier(shape)

  it('holds points inside a closed mesh and not those outside it', () => {
    expect(inside([1, 1.5, 2])).toBe(true)
    expect(inside([0.1, 2.9, 3.9])).toBe(true)
    expect(inside([-0.1, 1.5, 2])).toBe(false)
    expect(inside([2.1, 1.5, 2])).toBe(false)
    expect(inside([1, 3.5, 2])).toBe(false)
  })
})

describe('samplePoints', () => {
  it('keeps every point of a box, which fills its own bounds', () => {
    expect(samplePoints(shape, 500).length).toBe(500 * 3)
  })

  it('keeps none of the points in a hollow between two boxes', () => {
    const a = box([1, 1, 1])
    const b = box([1, 1, 1])
    const positions = [...a.positions, ...b.positions.map((x, i) => (i % 3 === 0 ? x + 3 : x))]
    const triangles = [...a.triangles, ...b.triangles.map(i => i + 8)]
    const pair = parseGlb(glbOf(positions, triangles))
    const pts = samplePoints(pair, 1000)
    for (let i = 0; i < pts.length; i += 3) expect(pts[i]! <= 1 || pts[i]! >= 3).toBe(true)
    expect(pts.length / 3).toBeGreaterThan(400)
    expect(pts.length / 3).toBeLessThan(1000)
  })
})
