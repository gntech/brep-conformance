import { describe, expect, it } from 'vitest'
import { parseDoc } from './parse'

const md = [
  '# Title',
  '',
  'Intro.',
  '## One',
  'a',
  '```text',
  '## not a heading',
  '```',
  '### One sub',
  'b',
  '## Two',
  'c',
].join('\n')

describe('parseDoc', () => {
  it('splits a doc into title, intro and sections, skipping headings inside code', () => {
    const d = parseDoc(md)
    expect(d.title).toBe('Title')
    expect(d.intro).toBe('Intro.')
    expect(d.sections.map(s => [s.level, s.heading, s.anchor])).toEqual([
      [2, 'One', 'one'],
      [3, 'One sub', 'one-sub'],
      [2, 'Two', 'two'],
    ])
    expect(d.sections[0]!.body).toBe('a\n```text\n## not a heading\n```')
  })
})
