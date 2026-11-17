import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import type { DocLinks } from '@/pages/operations/Markdown'
import { parseOperations } from '@/pages/operations/spec'
import { splitExample, type Example } from './example'
import { parseDoc } from './parse'

// Build-time only, like data/source.ts. The suite's docs beside this site, or BREP_API_MD names
// api.md and its siblings.
export const API_MD = resolve(process.env.BREP_API_MD ?? '../doc/api.md')
const DOC_DIR = dirname(API_MD)

// Where a link in a doc to anything the site does not render points.
export const DOC_BASE =
  process.env.BREP_DOC_URL ?? 'https://github.com/springcraft-ai/brep-conformance/blob/main/doc/'

export const DOCS_PATH = '/docs/'

// The one docs page, part by part. Each part is one file; its headings' ids take the prefix, so
// two files may share a heading. api.md's are bare, as its own links name them.
const PARTS = [
  { id: 'introduction', title: 'Introduction', file: 'overview.md', prefix: 'introduction-' },
  { id: 'api', title: 'API', file: 'api.md', prefix: '' },
  { id: 'the-contract', title: 'The contract', file: 'contract.md', prefix: 'the-contract-' },
  { id: 'result-files', title: 'Result files', file: 'formats.md', prefix: 'result-files-' },
  { id: 'process', title: 'Process', file: 'process.md', prefix: 'process-' },
] as const

export interface DocEntry {
  id: string
  heading: string
  body: string
  // A function of api.md: set in the machine face, with its example beside it.
  fn: boolean
  example: Example | null
}

export interface DocGroup {
  id: string
  heading: string
  body: string
  entries: DocEntry[]
  // Holds functions, so its entries take the two-column layout.
  functions: boolean
}

export interface DocPart {
  id: string
  title: string
  file: string
  intro: string
  groups: DocGroup[]
}

export const readDoc = (file: string) => readFileSync(join(DOC_DIR, file), 'utf8')

function functionIds(): Set<string> {
  return new Set(parseOperations(readDoc('api.md')).operations.map(o => o.id))
}

export function docParts(): DocPart[] {
  const fns = functionIds()
  return PARTS.map(p => {
    const parsed = parseDoc(readDoc(p.file))
    const groups: DocGroup[] = []
    for (const s of parsed.sections) {
      const id = p.prefix + s.anchor
      if (s.level === 2) {
        groups.push({ id, heading: s.heading, body: s.body, entries: [], functions: false })
        continue
      }
      const group = groups.at(-1)
      if (!group) throw new Error(`${p.file}: ### ${s.heading} before any ##`)
      const fn = p.file === 'api.md' && fns.has(s.heading)
      const { body, example } = fn ? splitExample(s.body) : { body: s.body, example: null }
      group.entries.push({ id, heading: s.heading, body, fn, example })
      group.functions ||= fn
    }
    return { id: `part-${p.id}`, title: p.title, file: p.file, intro: parsed.intro, groups }
  })
}

let local: { all: Record<string, string>; noFunctions: Record<string, string> } | undefined

// Every doc file and heading the docs page shows, to its place on the page. Pages other than the
// docs page keep a function's link on its own operation page.
function localLinks() {
  if (local) return local
  const all: Record<string, string> = {}
  const fns = functionIds()
  const noFunctions: Record<string, string> = {}
  for (const p of PARTS) {
    all[p.file] = `${DOCS_PATH}#part-${p.id}`
    for (const s of parseDoc(readDoc(p.file)).sections)
      all[`${p.file}#${s.anchor}`] = `${DOCS_PATH}#${p.prefix}${s.anchor}`
  }
  for (const [k, v] of Object.entries(all))
    if (!fns.has(k.replace(/^api\.md#/, ''))) noFunctions[k] = v
  local = { all, noFunctions }
  return local
}

// The links of one file, as the docs page resolves them, or another page that shows its text.
export function linksFor(file: string, on: 'docs' | 'elsewhere' = 'elsewhere'): DocLinks {
  const anchors = file === 'api.md' ? parseOperations(readDoc(file)).anchors : {}
  const l = localLinks()
  return { anchors, docBase: DOC_BASE, file, local: on === 'docs' ? l.all : l.noFunctions }
}
