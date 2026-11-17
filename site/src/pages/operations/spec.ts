// Parses doc/api.md into one entry per function. Pure, so it is tested on strings; reading the file
// is doc.ts's job.

// A function is a `###` section whose text has a signature, or a `##` section with no `###` whose
// text has one. Its id is the `###` heading, or the `##` heading lowercased. The protocol's sections
// (Lifecycle, Requests and replies) have no signature, so they are not functions.

export interface OperationDoc {
  id: string
  heading: string
  // The anchor GitHub gives the heading, so a link into api.md can name the function.
  anchor: string
  // The `##` section it sits in, such as Blends, and that section's text before its first `###`,
  // which every operation in it shares. Both verbatim.
  group: string
  groupIntro: string
  // The section's markdown, verbatim, without its heading.
  body: string
  signatures: string[]
}

export interface OperationsSpec {
  operations: OperationDoc[]
  // Every heading's anchor, to the operation it names; a group anchors to its first operation.
  anchors: Record<string, string>
}

export function anchorOf(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-')
}

function trimBlank(lines: string[]): string {
  return lines.join('\n').trim()
}

// A signature is a code span opening its own line that maps arguments to a result.
function signaturesOf(body: string): string[] {
  const out: string[] = []
  for (const line of body.split('\n'))
    for (const m of line.matchAll(/`([a-z_][a-z0-9_]*\([^`]*\)\s*->[^`]*)`/g))
      if (line.trimStart().startsWith('`')) out.push(m[1]!)
  return out
}

interface Section {
  heading: string
  lines: string[]
  subs: { heading: string; lines: string[] }[]
}

export function parseOperations(md: string): OperationsSpec {
  const sections: Section[] = []
  let fence = false
  for (const line of md.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence
    const h2 = !fence && /^## (.+)$/.exec(line)
    const h3 = !fence && /^### (.+)$/.exec(line)
    const cur = sections.at(-1)
    if (h2) sections.push({ heading: h2[1]!.trim(), lines: [], subs: [] })
    else if (h3) {
      if (!cur) throw new Error(`api.md: ### ${h3[1]} before any ##`)
      cur.subs.push({ heading: h3[1]!.trim(), lines: [] })
    } else if (cur) (cur.subs.at(-1)?.lines ?? cur.lines).push(line)
  }

  const operations: OperationDoc[] = []
  const anchors: Record<string, string> = {}
  for (const s of sections) {
    const intro = trimBlank(s.lines)
    if (s.subs.length) {
      for (const sub of s.subs) {
        const body = trimBlank(sub.lines)
        if (!signaturesOf(body).length) continue
        operations.push({
          id: sub.heading,
          heading: sub.heading,
          anchor: anchorOf(sub.heading),
          group: s.heading,
          groupIntro: intro,
          body,
          signatures: signaturesOf(body),
        })
        anchors[anchorOf(sub.heading)] = sub.heading
      }
      const first = s.subs.find(sub => signaturesOf(trimBlank(sub.lines)).length)
      if (first) anchors[anchorOf(s.heading)] = first.heading
    } else if (signaturesOf(intro).length) {
      const id = s.heading.toLowerCase().replace(/\s+/g, '_')
      operations.push({
        id,
        heading: s.heading,
        anchor: anchorOf(s.heading),
        group: s.heading,
        groupIntro: '',
        body: intro,
        signatures: signaturesOf(intro),
      })
      anchors[anchorOf(s.heading)] = id
    }
  }
  const seen = new Set<string>()
  for (const o of operations) {
    if (seen.has(o.id)) throw new Error(`api.md: two functions named ${o.id}`)
    seen.add(o.id)
  }
  return { operations, anchors }
}
