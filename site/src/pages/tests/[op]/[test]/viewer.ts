// Everything the Scan view needs in the browser, loaded as one chunk after the page hydrates.
import { parseGlb, type Shape } from './glb'
import { samplePoints } from './sample'

export { mountScan, type Mark, type Scene, type ScanHandle } from './scan'

export interface Loaded {
  shape: Shape
  cloud: Float32Array
  triangles: number
}

const cache = new Map<string, Promise<Loaded>>()

// The expected shape from its GLB, and its point cloud. Rejects when the file is not there.
export function loadShape(url: string): Promise<Loaded> {
  let p = cache.get(url)
  if (!p) {
    p = fetch(url, { mode: 'cors' })
      .then(r => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
        return r.arrayBuffer()
      })
      .then(buf => {
        const shape = parseGlb(buf)
        return { shape, cloud: samplePoints(shape), triangles: shape.triangles.length / 3 }
      })
    p.catch(() => cache.delete(url))
    cache.set(url, p)
  }
  return p
}
