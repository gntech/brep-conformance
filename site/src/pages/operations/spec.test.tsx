import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { site } from '@/data/source'
import { catalog } from './catalog'
import { API_MD } from './doc'
import { blocks, Markdown, resolveLink, type DocLinks } from './Markdown'
import { anchorOf, parseOperations } from './spec'

const MD = `# Operations

Intro, not an operation.

## Types

\`Length\` is a number.

## Calling a kernel

### Lifecycle

The client starts the worker.

## Constructors

### box

\`box(frame: Frame, size: [Length; 3]) -> Solid\`

A block. Placed by [\`transform\`](#transform), on [Types](#types).

## Booleans

\`union(a: Solid, b: Solid) -> Solid\`, \`difference(a: Solid, b: Solid) -> Solid\`

Combine **two** solids.

## Blends

Edges are named by points.

### fillet

\`fillet(s: Solid, r: Length) -> Solid\`

Rounds it.

## Moving a solid

### transform

\`transform(s: Solid) -> Solid\`
`

const links: DocLinks = { anchors: { transform: 'transform' }, docBase: 'D/', file: 'ops.md' }

describe('parseOperations', () => {
  const spec = parseOperations(MD)
  const byId = Object.fromEntries(spec.operations.map(o => [o.id, o]))

  it('takes each ### and each ## with a signature but no ###, in order', () => {
    expect(spec.operations.map(o => o.id)).toEqual(['box', 'booleans', 'fillet', 'transform'])
  })

  it('keeps the definition verbatim and lists its signatures', () => {
    expect(byId.box!.body).toBe(
      '`box(frame: Frame, size: [Length; 3]) -> Solid`\n\n' +
        'A block. Placed by [`transform`](#transform), on [Types](#types).',
    )
    expect(byId.booleans!.signatures).toEqual([
      'union(a: Solid, b: Solid) -> Solid',
      'difference(a: Solid, b: Solid) -> Solid',
    ])
  })

  it("carries the group's shared text", () => {
    expect(byId.fillet!).toMatchObject({
      group: 'Blends',
      groupIntro: 'Edges are named by points.',
    })
    expect(byId.box!.groupIntro).toBe('')
  })

  it('maps anchors to operations, and a group to its first', () => {
    expect(spec.anchors).toMatchObject({ box: 'box', booleans: 'booleans', blends: 'fillet' })
    expect(spec.anchors.types).toBeUndefined()
    expect(spec.anchors.lifecycle).toBeUndefined()
    expect(anchorOf('Moving a solid')).toBe('moving-a-solid')
  })

  it('rejects two operations of one name', () => {
    const md = '## A\n### x\n`x(a: A) -> B`\n## B\n### x\n`x(a: A) -> B`\n'
    expect(() => parseOperations(md)).toThrow(/two functions/)
  })
})

describe('Markdown', () => {
  it('renders code, bold and links, operation anchors to their page', () => {
    const html = renderToStaticMarkup(
      <Markdown
        source={'A [`transform`](#transform), **b**, [T](#types), [c](c.md).'}
        links={links}
      />,
    )
    expect(html).toBe(
      '<p>A <a href="/operations/transform/"><code>transform</code></a>, <strong>b</strong>, ' +
        '<a href="D/ops.md#types">T</a>, <a href="D/c.md">c</a>.</p>',
    )
  })

  it('sets each signature of a signature line on its own line, text unchanged', () => {
    const html = renderToStaticMarkup(
      <Markdown source={'`f(a) -> B`, `g(c) -> D`'} links={links} />,
    )
    expect(html).toBe(
      '<p class="bc-op-sig"><span><code>f(a) -&gt; B</code>,</span>' +
        '<span><code>g(c) -&gt; D</code></span></p>',
    )
  })

  it('joins wrapped lines and reads lists', () => {
    expect(blocks('one\ntwo\n\n- a\n  more\n- b')).toEqual([
      { type: 'p', text: 'one two' },
      { type: 'ul', items: ['a more', 'b'] },
    ])
  })

  it('reads a pipe table', () => {
    expect(blocks('| a | `b \\| c` |\n| - | - |\n| 1 | 2 |')).toEqual([
      { type: 'table', head: ['a', '`b \\| c`'], rows: [['1', '2']] },
    ])
  })

  it('keeps a fenced block verbatim, blank lines and all', () => {
    expect(blocks('a\n\n```text\n> x\n\n< y\n```\nb')).toEqual([
      { type: 'p', text: 'a' },
      { type: 'code', text: '> x\n\n< y' },
      { type: 'p', text: 'b' },
    ])
    expect(() => blocks('```\nopen')).toThrow(/unclosed/)
  })

  it('names a file outside doc/ without the "..", and a directory as a tree', () => {
    const links = {
      anchors: {},
      docBase: 'https://example.test/repo/blob/main/suite/doc/',
      file: 'formats.md',
    }
    expect(resolveLink('../src/run.rs', links)).toBe(
      'https://example.test/repo/blob/main/suite/src/run.rs',
    )
    expect(resolveLink('../protocol/', links)).toBe(
      'https://example.test/repo/tree/main/suite/protocol/',
    )
    expect(resolveLink('versioning.md', links)).toBe(
      'https://example.test/repo/blob/main/suite/doc/versioning.md',
    )
  })

  it('sends a link to a doc the site renders to its page', () => {
    const local = { ...links, local: { 'c.md': '/c/', 'ops.md#types': '/adapter/#types' } }
    const html = renderToStaticMarkup(<Markdown source={'[c](c.md), [T](#types)'} links={local} />)
    expect(html).toBe('<p><a href="/c/">c</a>, <a href="/adapter/#types">T</a></p>')
  })

  it('refuses a block it does not render', () => {
    expect(() => blocks('> quoted')).toThrow(/unsupported/)
    expect(() => blocks('| a |\nnot a rule')).toThrow(/unsupported/)
  })
})

describe('api.md and the results', () => {
  const spec = parseOperations(readFileSync(API_MD, 'utf8'))
  const ops = catalog(spec.operations, site().latest)

  it('renders every function of the real file', () => {
    expect(spec.operations.length).toBeGreaterThan(40)
    for (const o of spec.operations) {
      expect(() => blocks(o.body)).not.toThrow()
      expect(() => blocks(o.groupIntro)).not.toThrow()
    }
  })

  it('names every function a kernel reports unsupported', () => {
    const ids = new Set(ops.map(o => o.id))
    const named = site().latest.flatMap(r => r.unsupported)
    expect(named.filter(f => !ids.has(f))).toEqual([])
  })
})
