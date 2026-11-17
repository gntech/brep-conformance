import { anchorOf } from '@/pages/operations/spec'

// Splits one of the suite's markdown docs into its title, the text before its first `##`, and one
// section per `##` or `###`. Pure; reading the files is source.ts's job.

export interface DocSection {
  level: 2 | 3
  heading: string
  anchor: string
  body: string
}

export interface ParsedDoc {
  title: string
  intro: string
  sections: DocSection[]
}

export function parseDoc(md: string): ParsedDoc {
  let title = ''
  const intro: string[] = []
  const sections: (DocSection & { lines: string[] })[] = []
  let fence = false
  for (const line of md.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence
    const h = fence ? null : /^(#{1,3}) (.+)$/.exec(line)
    if (h && h[1] === '#' && !title && !sections.length) title = h[2]!.trim()
    else if (h && h[1] !== '#') {
      const heading = h[2]!.trim()
      const level = h[1]!.length as 2 | 3
      sections.push({ level, heading, anchor: anchorOf(heading), body: '', lines: [] })
    } else (sections.at(-1)?.lines ?? intro).push(line)
  }
  return {
    title,
    intro: intro.join('\n').trim(),
    sections: sections.map(({ lines, ...s }) => ({ ...s, body: lines.join('\n').trim() })),
  }
}
