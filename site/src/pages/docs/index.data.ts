import { docParts, linksFor, type DocPart } from '@/docs/source'
import type { DocLinks } from '@/pages/operations/Markdown'
import type { PageEntry } from '@/site/page'

export interface Props {
  parts: DocPart[]
  links: Record<string, DocLinks>
}

export function entries(): PageEntry<Props>[] {
  const parts = docParts()
  return [
    {
      props: {
        parts,
        links: Object.fromEntries(parts.map(p => [p.file, linksFor(p.file, 'docs')])),
      },
      title: 'docs',
      description:
        'The brep-conformance documentation on one page: the API, the contract, the result ' +
        'files and the process.',
    },
  ]
}
