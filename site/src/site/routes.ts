// File-based routes. Under src/pages/, a directory is a path segment and `[name]` a parameter:
//   index.page.tsx            -> /
//   about.page.tsx            -> /about/
//   reports/[kernel]/index.page.tsx -> /reports/<kernel>/
//   badges/[kernel].svg.ts    -> /badges/<kernel>.svg  (an endpoint: any extension before .ts)

export type Params = Record<string, string>

export interface Route {
  // The page or endpoint module's key in import.meta.glob, e.g. ./pages/index.page.tsx.
  module: string
  kind: 'page' | 'endpoint'
  // The URL pattern, e.g. /reports/[kernel]/[version]/.
  pattern: string
  params: string[]
}

const PAGE = /\.page\.tsx$/
const ENDPOINT = /\.([a-z0-9]+)\.ts$/

export function routeOf(module: string): Route {
  const rel = module.replace(/^\.\/pages\//, '')
  let pattern: string
  let kind: Route['kind']
  if (PAGE.test(rel)) {
    kind = 'page'
    const path = rel.replace(PAGE, '').replace(/(^|\/)index$/, '')
    pattern = path ? `/${path}/` : '/'
  } else if (ENDPOINT.test(rel) && !rel.endsWith('.data.ts') && !rel.endsWith('.test.ts')) {
    kind = 'endpoint'
    pattern = `/${rel.replace(/\.ts$/, '')}`
  } else {
    throw new Error(`${module}: not a page (*.page.tsx) or an endpoint (*.<ext>.ts)`)
  }
  const params = [...pattern.matchAll(/\[([a-zA-Z0-9_]+)\]/g)].map(m => m[1]!)
  return { module, kind, pattern, params }
}

// The data module that sits beside a page: index.page.tsx -> index.data.ts.
export function dataModuleOf(module: string): string {
  return module.replace(PAGE, '.data.ts')
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|\\]/g, '\\$&')
}

export function matchRoute(route: Route, path: string): Params | null {
  const parts = route.pattern.split(/(\[[a-zA-Z0-9_]+\])/)
  const re = parts.map(p => (/^\[.+\]$/.test(p) ? '([^/]+)' : escape(p))).join('')
  const m = new RegExp(`^${re}$`).exec(path)
  if (!m) return null
  return Object.fromEntries(route.params.map((k, i) => [k, decodeURIComponent(m[i + 1]!)]))
}

export function pathOf(route: Route, params: Params): string {
  return route.pattern.replace(/\[([a-zA-Z0-9_]+)\]/g, (_, k: string) => {
    const v = params[k]
    if (!v || v.includes('/') || v === '.' || v === '..')
      throw new Error(`${route.module}: bad param ${k}=${v}`)
    return encodeURIComponent(v)
  })
}

// Where a path lands in the static output: a directory's index.html, or the endpoint's own file.
// Decoded, since a static host decodes a request's path before it looks for the file.
export function fileOf(path: string): string {
  const rel = path.replace(/^\//, '').split('/').map(decodeURIComponent).join('/')
  return rel === '' || rel.endsWith('/') ? `${rel}index.html` : rel
}

// Most specific first, so /reports/latest/ would win over /reports/[kernel]/.
export function sortRoutes(routes: Route[]): Route[] {
  const score = (r: Route) => r.pattern.split('/').map(s => (s.includes('[') ? 1 : 0))
  return [...routes].sort((a, b) => {
    const sa = score(a)
    const sb = score(b)
    for (let i = 0; i < Math.min(sa.length, sb.length); i++)
      if (sa[i] !== sb[i]) return sa[i]! - sb[i]!
    return a.pattern.localeCompare(b.pattern)
  })
}
