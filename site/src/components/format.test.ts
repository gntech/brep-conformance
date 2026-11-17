import { describe, expect, it } from 'vitest'
import { condense } from './format'

describe('condense', () => {
  it('says a run of one message once, with its count', () => {
    expect(condense('B1: bad edge; bad edge; bad edge; skipped; 3 issues')).toBe(
      'B1: bad edge ×3; skipped; 3 issues',
    )
  })

  it('leaves a reason with no repeat as it is', () => {
    expect(condense('B15: 8 points misplaced; 1 allowed')).toBe(
      'B15: 8 points misplaced; 1 allowed',
    )
  })

  it('keeps a message under another clause apart', () => {
    expect(condense('B1: bad edge; B2: bad edge')).toBe('B1: bad edge; B2: bad edge')
  })

  it('counts only messages that follow one another', () => {
    expect(condense('a; b; a')).toBe('a; b; a')
  })
})
