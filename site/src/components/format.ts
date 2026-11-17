export function pct(x: number, digits = 1): string {
  return `${(x * 100).toFixed(digits)}%`
}

export function ms(x: number | null): string {
  if (x === null) return '–'
  if (x >= 1000) return `${(x / 1000).toPrecision(3)} s`
  return `${x.toPrecision(3)} ms`
}

export function factor(x: number | null): string {
  return x === null ? '–' : `${x.toFixed(2)}×`
}

export function sci(x: number, digits = 1): string {
  return x.toExponential(digits)
}

export function date(iso: string): string {
  return iso.slice(0, 10)
}

// A reason with a run of one message said once: "A; A; A; B" reads "A ×3; B". A clause's label on
// the first of a run ("B1: A; A; A") does not set it apart from the rest; a part with a label of
// its own ("B2: A") is another clause's and starts a new run.
export function condense(text: string): string {
  const bare = (part: string) => part.replace(/^[A-Z]\d+:\s*/, '')
  const runs: { text: string; n: number }[] = []
  for (const part of text.split('; ')) {
    const last = runs[runs.length - 1]
    if (last && (part === last.text || part === bare(last.text))) last.n++
    else runs.push({ text: part, n: 1 })
  }
  return runs.map(r => (r.n > 1 ? `${r.text} ×${r.n}` : r.text)).join('; ')
}
