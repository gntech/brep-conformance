import { describe, expect, it } from 'vitest'
import { prettyJson, splitExample } from './example'

describe('splitExample', () => {
  const body = [
    'Text.',
    '',
    '**Example.** Solid 1 is a box',
    'at the origin.',
    '',
    '```text',
    '> {"cmd": "f", "s": 1,',
    '   "x": [1, 2]}',
    '< {"ok": "a\\n',
    '   b"}',
    '```',
  ].join('\n')

  it('takes the example out of the body, joining continued lines', () => {
    expect(splitExample(body)).toEqual({
      body: 'Text.',
      example: {
        note: 'Solid 1 is a box at the origin.',
        request: '{"cmd": "f", "s": 1, "x": [1, 2]}',
        reply: '{"ok": "a\\nb"}',
      },
    })
  })

  it('leaves a body with no example as it is', () => {
    expect(splitExample('Text.\n\n```text\nplain\n```')).toEqual({
      body: 'Text.\n\n```text\nplain\n```',
      example: null,
    })
  })
})

describe('prettyJson', () => {
  it('keeps a short value on one line, numbers as written', () => {
    expect(prettyJson('{"ok": [5.0, -0.0]}')).toBe('{"ok": [5.0, -0.0]}')
  })

  it('breaks a long value, packing short items and keeping a shortened run', () => {
    const text = '{"cmd": "x", "points": [[1.0, 2.0, 3.0], [4.0, 5.0, 6.0], … 9 more]}'
    expect(prettyJson(text, 30)).toBe(
      [
        '{',
        '  "cmd": "x",',
        '  "points": [',
        '    [1.0, 2.0, 3.0],',
        '    [4.0, 5.0, 6.0], … 9 more',
        '  ]',
        '}',
      ].join('\n'),
    )
  })

  it('returns text it cannot read unchanged', () => {
    expect(prettyJson('{"ok": [')).toBe('{"ok": [')
  })
})
