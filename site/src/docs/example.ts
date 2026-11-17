// A function's example in api.md: a paragraph opening **Example.** with what the call runs on, then
// a text block where `>` opens the request and `<` the reply, and a line indented three spaces goes
// on with the one before. Pure; the docs page renders it beside the function.

export interface Example {
  note: string
  request: string
  reply: string
}

const NOTE = /^\*\*Example\.\*\*\s*/
const FENCE = /^```text\n([\s\S]*?)\n```$/

function joinLines(lines: string[]): string {
  return lines.reduce((a, l) => a + (a.endsWith(',') ? ' ' : '') + l.replace(/^ {3}/, ''), '')
}

function callOf(fence: string): { request: string; reply: string } | null {
  const request: string[] = []
  const reply: string[] = []
  let into: string[] | null = null
  for (const line of fence.split('\n')) {
    if (line.startsWith('> ')) (into = request).push(line.slice(2))
    else if (line.startsWith('< ')) (into = reply).push(line.slice(2))
    else if (line.startsWith('   ') && into) into.push(line)
    else return null
  }
  return request.length && reply.length
    ? { request: joinLines(request), reply: joinLines(reply) }
    : null
}

// The body without its example, and the example; the body unchanged when it has none.
export function splitExample(body: string): { body: string; example: Example | null } {
  const chunks = body.split(/\n\s*\n(?=\S)/)
  for (let i = 0; i < chunks.length - 1; i++) {
    if (!NOTE.test(chunks[i]!)) continue
    const fence = FENCE.exec(chunks[i + 1]!.trim())
    const call = fence && callOf(fence[1]!)
    if (!call) continue
    const note = chunks[i]!.replace(NOTE, '')
      .replace(/\s*\n\s*/g, ' ')
      .trim()
    const rest = [...chunks.slice(0, i), ...chunks.slice(i + 2)].join('\n\n').trim()
    return { body: rest, example: { note, ...call } }
  }
  return { body, example: null }
}

// A JSON value as written, numbers and strings kept to the letter, and `… 5 more` kept where a
// shortened example stands in for array items.
type Node = { arr: Node[] } | { obj: [string, Node][] } | { raw: string }

function parse(text: string): Node {
  let i = 0
  const ws = () => {
    while (/\s/.test(text[i] ?? '')) i++
  }
  const value = (): Node => {
    ws()
    const c = text[i]
    if (c === '[' || c === '{') {
      const close = c === '[' ? ']' : '}'
      i++
      const items: Node[] = []
      const keys: string[] = []
      ws()
      while (text[i] !== close) {
        if (i >= text.length) throw new Error('unclosed')
        if (c === '{') {
          const k = value()
          if (!('raw' in k)) throw new Error('bad key')
          ws()
          if (text[i++] !== ':') throw new Error('expected :')
          keys.push(k.raw)
        }
        items.push(value())
        ws()
        if (text[i] === ',') i++
        ws()
      }
      i++
      return c === '[' ? { arr: items } : { obj: keys.map((k, j) => [k, items[j]!]) }
    }
    const start = i
    if (c === '"') {
      i++
      while (i < text.length && text[i] !== '"') i += text[i] === '\\' ? 2 : 1
      i++
    } else while (i < text.length && !/[,\]}]/.test(text[i]!)) i++
    const raw = text.slice(start, i).trim()
    if (!raw) throw new Error(`no value at ${start}`)
    return { raw }
  }
  const v = value()
  ws()
  if (i < text.length) throw new Error(`trailing text at ${i}`)
  return v
}

function inline(n: Node): string {
  if ('raw' in n) return n.raw
  if ('arr' in n) return `[${n.arr.map(inline).join(', ')}]`
  return `{${n.obj.map(([k, v]) => `${k}: ${inline(v)}`).join(', ')}}`
}

// One line where it fits in `width`. Else an object takes a line per key, and an array of values
// that each fit on a line is packed, as many to a line as fit, so a list of points stays short.
export function prettyJson(text: string, width = 52): string {
  let root: Node
  try {
    root = parse(text)
  } catch {
    return text
  }
  const fmt = (n: Node, indent: number, lead: number): string => {
    const one = inline(n)
    if ('raw' in n || indent + lead + one.length <= width) return one
    const pad = ' '.repeat(indent + 2)
    if ('arr' in n) {
      const flat = n.arr.map(inline)
      if (flat.every(s => indent + 2 + s.length + 1 <= width)) {
        const lines: string[] = []
        for (const s of flat) {
          const last = lines.at(-1)
          if (last !== undefined && last.length + 2 + s.length + 1 <= width)
            lines[lines.length - 1] = `${last}, ${s}`
          else lines.push(pad + s)
        }
        return `[\n${lines.join(',\n')}\n${' '.repeat(indent)}]`
      }
    }
    const items =
      'arr' in n
        ? n.arr.map(v => pad + fmt(v, indent + 2, 0))
        : n.obj.map(([k, v]) => `${pad}${k}: ${fmt(v, indent + 2, k.length + 2)}`)
    const [open, close] = 'arr' in n ? ['[', ']'] : ['{', '}']
    return `${open}\n${items.join(',\n')}\n${' '.repeat(indent)}${close}`
  }
  return fmt(root, 0, 0)
}
