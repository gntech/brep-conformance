import type { ReactNode } from 'react'
import { href, url } from '@/site/href'

// Renders the subset of markdown the suite's docs write: paragraphs, bullet and numbered lists, pipe
// tables, fenced code, code spans, bold, emphasis and links. Headings are the caller's: it splits a
// file into sections first. Any other block throws at build time rather than render wrong.

export interface DocLinks {
  // Heading anchors of the source file that name an operation, to that operation's id.
  anchors: Record<string, string>
  // The URL of the source file's directory, for every other link.
  docBase: string
  file: string
  // Doc files and their headings that the site renders, as `file` or `file#anchor`, to the site
  // path that shows them.
  local?: Record<string, string>
}

export function resolveLink(target: string, links: DocLinks): string {
  if (/^[a-z]+:/i.test(target)) return target
  const [file, anchor] = target.startsWith('#')
    ? [links.file, target.slice(1)]
    : (target.split('#') as [string, string?])
  const local = links.local?.[anchor ? `${file}#${anchor}` : file]
  if (local) return href(local)
  if (target.startsWith('#')) {
    const op = links.anchors[target.slice(1)]
    return op ? url.operation(op) : links.docBase + links.file + target
  }
  // Resolved, so a link out of doc/ ("../suite/src/run.rs") names its file without the "..", and a
  // directory is linked as GitHub shows one.
  if (!URL.canParse(target, links.docBase)) return links.docBase + target
  const out = new URL(target, links.docBase).href
  return out.endsWith('/') ? out.replace('/blob/', '/tree/') : out
}

const INLINE = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*|\[((?:`[^`]*`|[^\]])+)\]\(([^)\s]+)\)/g

export function inline(text: string, links: DocLinks): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let i = 0
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const [, code, strong, em, label, target] = m
    if (code !== undefined)
      out.push(
        <code key={i++} className={isFormula(code) ? 'bc-math' : undefined}>
          {code}
        </code>,
      )
    else if (strong !== undefined) out.push(<strong key={i++}>{inline(strong, links)}</strong>)
    else if (em !== undefined) out.push(<em key={i++}>{inline(em, links)}</em>)
    else
      out.push(
        <a key={i++} href={resolveLink(target!, links)}>
          {inline(label!, links)}
        </a>,
      )
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export type Block =
  | { type: 'p'; text: string }
  | { type: 'ul' | 'ol'; items: string[] }
  | { type: 'table'; head: string[]; rows: string[][] }
  | { type: 'code'; text: string }

// A code span that writes mathematics, not an identifier or a signature: it carries a symbol no
// name has and no arrow of a signature.
export function isFormula(code: string): boolean {
  return /[·∮σ²³≤≥∈Ω√π×′]/.test(code) && !code.includes('->')
}

// A paragraph of code spans alone states signatures.
const SIGNATURE = /^`[^`]+`(,\s*`[^`]+`)*$/

const ITEM = /^(\s*)([-*]|\d+\.)\s+(.*)$/

function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split(/(?<!\\)\|/)
    .map(c => c.trim())
}

function table(lines: string[]): Block {
  const [head, rule, ...rows] = lines.map(l => l.trim())
  if (!rule || !/^\|?[\s:|-]+\|?$/.test(rule) || !rows.every(r => r.startsWith('|')))
    throw new Error(`unsupported markdown table: ${head}`)
  return { type: 'table', head: cells(head!), rows: rows.map(cells) }
}

const FENCE = /^\s*(```|~~~)/

// Fenced code first, verbatim, so a blank line inside it does not split it.
function segments(md: string): ({ code: string } | { text: string })[] {
  const out: ({ code: string } | { text: string })[] = []
  let text: string[] = []
  let code: string[] | null = null
  for (const line of md.split('\n')) {
    if (FENCE.test(line)) {
      if (code) {
        out.push({ code: code.join('\n') })
        code = null
      } else {
        out.push({ text: text.join('\n') })
        text = []
        code = []
      }
    } else (code ?? text).push(line)
  }
  if (code) throw new Error('unsupported markdown: an unclosed code fence')
  out.push({ text: text.join('\n') })
  return out
}

export function blocks(md: string): Block[] {
  const out: Block[] = []
  for (const seg of segments(md)) {
    if ('code' in seg) out.push({ type: 'code', text: seg.code })
    else out.push(...textBlocks(seg.text))
  }
  return out
}

function textBlocks(md: string): Block[] {
  const out: Block[] = []
  for (const chunk of md.split(/\n\s*\n/)) {
    const lines = chunk.split('\n').filter(l => l.trim())
    if (!lines.length) continue
    if (lines[0]!.trim().startsWith('|')) {
      out.push(table(lines))
      continue
    }
    if (/^(#|>|```|~~~|<)/.test(lines[0]!.trim()))
      throw new Error(`unsupported markdown block: ${lines[0]}`)
    const first = ITEM.exec(lines[0]!)
    if (!first) {
      out.push({ type: 'p', text: lines.map(l => l.trim()).join(' ') })
      continue
    }
    const items: string[] = []
    for (const l of lines) {
      const m = ITEM.exec(l)
      if (m && m[1]!.length === first[1]!.length) items.push(m[3]!)
      else items[items.length - 1] += ' ' + l.trim()
    }
    out.push({ type: /\d/.test(first[2]!) ? 'ol' : 'ul', items })
  }
  return out
}

export function Markdown({ source, links }: { source: string; links: DocLinks }) {
  return (
    <>
      {blocks(source).map((b, i) => {
        if (b.type === 'p' && SIGNATURE.test(b.text))
          return (
            <p key={i} className="bc-op-sig">
              {b.text.split(/(?<=,)\s*(?=`)/).map((sig, j) => (
                <span key={j}>{inline(sig, links)}</span>
              ))}
            </p>
          )
        if (b.type === 'p') return <p key={i}>{inline(b.text, links)}</p>
        if (b.type === 'code')
          return (
            <pre key={i} className="bc-op-code" tabIndex={0}>
              <code>{b.text}</code>
            </pre>
          )
        if (b.type === 'table')
          return (
            <div key={i} className="bc-op-scroll">
              <table className="bc-op-table">
                <thead>
                  <tr>
                    {b.head.map((h, j) => (
                      <th key={j}>{inline(h, links)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.rows.map((r, j) => (
                    <tr key={j}>
                      {r.map((c, k) => (
                        <td key={k}>{inline(c, links)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        const List = b.type
        return (
          <List key={i}>
            {b.items.map((it, j) => (
              <li key={j}>{inline(it, links)}</li>
            ))}
          </List>
        )
      })}
    </>
  )
}
