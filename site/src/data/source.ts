import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { buildSite, parseReport, type Report, type Site } from './results'

// Build-time only: a page's *.data.ts may import this, a *.page.tsx never does.

// With no BREP_REPORTS_DIR the site is built with no results.
export const REPORTS_DIR = process.env.BREP_REPORTS_DIR
  ? resolve(process.env.BREP_REPORTS_DIR)
  : null

function subdirs(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('.'))
    .map(e => e.name)
    .sort()
}

// <suite>/<kernel>/<version>/report.json: one kernel release keeps a report per suite version, so a
// rerun on a new suite never replaces the result an older link names.
export function readReports(dir = REPORTS_DIR): Report[] {
  if (!dir) return []
  const out: Report[] = []
  for (const suite of subdirs(dir)) {
    for (const kernel of subdirs(join(dir, suite))) {
      for (const version of subdirs(join(dir, suite, kernel))) {
        const file = join(dir, suite, kernel, version, 'report.json')
        if (!existsSync(file)) continue
        const report = parseReport(JSON.parse(readFileSync(file, 'utf8')), file)
        const id = report.identity
        const on = report.methodology.suite
        if (on !== suite || id.kernel !== kernel || id.version !== version)
          throw new Error(`${file}: says ${id.kernel} ${id.version} on suite ${on}`)
        out.push(report)
      }
    }
  }
  return out
}

let cached: Site | undefined

export function site(): Site {
  cached ??= buildSite(readReports())
  return cached
}
