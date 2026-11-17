import { readFileSync } from 'node:fs'
import { API_MD, linksFor } from '@/docs/source'
import { site } from '@/data/source'
import { catalog, type Operation } from './catalog'
import type { DocLinks } from './Markdown'
import { parseOperations } from './spec'

// Build-time only, like source.ts.
export { API_MD }

let cached: { operations: Operation[]; links: DocLinks } | undefined

export function operations(): { operations: Operation[]; links: DocLinks } {
  if (!cached) {
    const spec = parseOperations(readFileSync(API_MD, 'utf8'))
    cached = { operations: catalog(spec.operations, site().latest), links: linksFor('api.md') }
  }
  return cached
}
