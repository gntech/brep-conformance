import type { PageEntry } from '@/site/page'
import type { Operation } from '../catalog'
import { operations } from '../doc'
import type { DocLinks } from '../Markdown'

export interface Props {
  op: Operation
  links: DocLinks
}

export function entries(): PageEntry<Props>[] {
  const { operations: ops, links } = operations()
  return ops.map(op => ({
    params: { op: op.id },
    props: { op, links },
    title: op.id,
    description: op.doc?.signatures[0],
  }))
}
