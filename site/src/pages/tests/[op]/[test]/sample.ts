// The shape's own point cloud: a Halton sequence over its box, kept where the mesh holds the point.
// It stands in for the suite's sample, which the report does not carry; it is drawn from the
// published mesh, so it shows where the expected shape is, not what any kernel answered.
import type { Shape } from './glb'

export type Vec3 = [number, number, number]

export function bounds(xs: ArrayLike<number>): { lo: Vec3; hi: Vec3 } | null {
  if (xs.length < 3) return null
  const lo: Vec3 = [Infinity, Infinity, Infinity]
  const hi: Vec3 = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i + 2 < xs.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k]!, xs[i + k]!)
      hi[k] = Math.max(hi[k]!, xs[i + k]!)
    }
  }
  return { lo, hi }
}

export function halton(i: number, base: number): number {
  let f = 1
  let r = 0
  for (let n = i; n > 0; n = Math.floor(n / base)) {
    f /= base
    r += f * (n % base)
  }
  return r
}

// Membership by the parity of a ray's crossings along +x. Triangles are binned on a grid over
// (y, z) so each ray tests only those whose shadow it could fall in.
export function classifier(shape: Shape): (p: Vec3) => boolean {
  const { positions: P, triangles: T } = shape
  const b = bounds(P)
  if (!b || !T.length) return () => false
  const N = 32
  const [y0, z0] = [b.lo[1], b.lo[2]]
  const dy = (b.hi[1] - y0) / N || 1
  const dz = (b.hi[2] - z0) / N || 1
  const cell = (v: number, v0: number, d: number) =>
    Math.min(N - 1, Math.max(0, Math.floor((v - v0) / d)))
  const grid: number[][] = Array.from({ length: N * N }, () => [])
  for (let t = 0; t < T.length; t += 3) {
    const ys = [0, 1, 2].map(k => P[T[t + k]! * 3 + 1]!)
    const zs = [0, 1, 2].map(k => P[T[t + k]! * 3 + 2]!)
    const [i0, i1] = [cell(Math.min(...ys), y0, dy), cell(Math.max(...ys), y0, dy)]
    const [j0, j1] = [cell(Math.min(...zs), z0, dz), cell(Math.max(...zs), z0, dz)]
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) grid[i * N + j]!.push(t)
  }
  return ([x, y, z]) => {
    if (y < b.lo[1] || y > b.hi[1] || z < b.lo[2] || z > b.hi[2]) return false
    let crossings = 0
    for (const t of grid[cell(y, y0, dy) * N + cell(z, z0, dz)]!) {
      const [a, c, d] = [0, 1, 2].map(k => T[t + k]! * 3) as [number, number, number]
      // Barycentric coordinates of (y, z) in the triangle's shadow on the (y, z) plane.
      const [ay, az, cy, cz, ey, ez] = [
        P[a + 1]!,
        P[a + 2]!,
        P[c + 1]!,
        P[c + 2]!,
        P[d + 1]!,
        P[d + 2]!,
      ]
      const det = (cy - ay) * (ez - az) - (ey - ay) * (cz - az)
      if (det === 0) continue
      const u = ((y - ay) * (ez - az) - (ey - ay) * (z - az)) / det
      const v = ((cy - ay) * (z - az) - (y - ay) * (cz - az)) / det
      if (u < 0 || v < 0 || u + v >= 1) continue
      const hit = P[a]! + u * (P[c]! - P[a]!) + v * (P[d]! - P[a]!)
      if (hit > x) crossings++
    }
    return crossings % 2 === 1
  }
}

// `count` points of the sequence in the shape's box that the shape holds, as xyz triples.
export function samplePoints(shape: Shape, count = 4096): Float32Array {
  const b = bounds(shape.positions)
  if (!b) return new Float32Array(0)
  const inside = classifier(shape)
  const out: number[] = []
  for (let i = 1; i <= count; i++) {
    const p: Vec3 = [
      b.lo[0] + halton(i, 2) * (b.hi[0] - b.lo[0]),
      b.lo[1] + halton(i, 3) * (b.hi[1] - b.lo[1]),
      b.lo[2] + halton(i, 5) * (b.hi[2] - b.lo[2]),
    ]
    if (inside(p)) out.push(...p)
  }
  return Float32Array.from(out)
}
