// A README badge: shields' 20 px height, Alt-1's void ground, micro-caps label and machine-face
// value. GitHub serves it as an image, so no web font loads; the faces are system stacks, and
// textLength pins each run to the width measured here whatever face the viewer has.

// Helvetica's advance widths in 1/1000 em for printable ASCII; Arial shares them.
const HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667,
  611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500,
  222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
]
// Menlo, DejaVu Sans Mono and SF Mono all advance 0.6 em.
const MONO = 600

export const HEIGHT = 20
const LABEL_SIZE = 9
const LABEL_TRACKING = 0.12
const VALUE_SIZE = 11
const PAD = 7
const SWATCH = 6
const SWATCH_GAP = 5
const CUT = 4

export const COLORS = {
  ground: '#000000',
  rule: '#3A3C3E',
  label: '#A2A4A6',
  value: '#FFFFFF',
  tier: '#FFD166',
} as const

const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif"
const MACHINE = "ui-monospace,'SF Mono',Menlo,Consolas,'DejaVu Sans Mono',monospace"

export function sansWidth(text: string, size: number, tracking = 0): number {
  let w = 0
  for (const ch of text) {
    const c = ch.codePointAt(0)!
    w += (c >= 32 && c <= 126 ? HELVETICA[c - 32]! : 1000) / 1000 + tracking
  }
  return w * size
}

export function monoWidth(text: string, size: number): number {
  return ([...text].length * MONO * size) / 1000
}

const round = (x: number) => Math.round(x * 10) / 10

const esc = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.codePointAt(0)};`)

export interface BadgeText {
  label: string
  value: string
  title: string
}

// `olderSuite` names the suite version the rate is from when it is not the current one.
export function badgeText(kernel: string, passRate: number, olderSuite?: string): BadgeText {
  const value = `${(passRate * 100).toFixed(1)}% @ 1e-7`
  const suite = olderSuite ? ` on suite ${olderSuite}` : ''
  return {
    label: 'brep-conformance',
    value,
    title: `brep-conformance: ${kernel}, ${value} mm${suite}`,
  }
}

// The label in micro caps on the left, a hairline, then the 1e-7 tier's swatch and the value. The
// frame takes a control's one cut corner, bottom right.
export function renderBadge({ label, value, title }: BadgeText): string {
  const caps = label.toUpperCase()
  // The tracking after the last letter is not ink, so textLength leaves it out.
  const labelW = round(sansWidth(caps, LABEL_SIZE, LABEL_TRACKING) - LABEL_TRACKING * LABEL_SIZE)
  const valueW = round(monoWidth(value, VALUE_SIZE))
  const split = round(PAD + labelW + PAD)
  const swatchX = round(split + PAD)
  const valueX = round(swatchX + SWATCH + SWATCH_GAP)
  const width = Math.ceil(valueX + valueW + PAD)
  const h = HEIGHT
  const frame = `M0.5 0.5H${width - 0.5}V${h - 0.5 - CUT}L${width - 0.5 - CUT} ${h - 0.5}H0.5Z`
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}"`,
    ` viewBox="0 0 ${width} ${h}" role="img" aria-label="${esc(title)}">`,
    `<title>${esc(title)}</title>`,
    `<path d="${frame}" fill="${COLORS.ground}" stroke="${COLORS.rule}"/>`,
    `<path d="M${split} 0.5V${h - 0.5}" stroke="${COLORS.rule}"/>`,
    `<text x="${PAD}" y="13.2" fill="${COLORS.label}" font-family="${SANS}"`,
    ` font-size="${LABEL_SIZE}" font-weight="600" letter-spacing="${LABEL_TRACKING}em"`,
    ` textLength="${labelW}" lengthAdjust="spacingAndGlyphs">${esc(caps)}</text>`,
    `<rect x="${swatchX}" y="${(h - SWATCH) / 2}" width="${SWATCH}" height="${SWATCH}"`,
    ` fill="${COLORS.tier}"/>`,
    `<text x="${valueX}" y="13.8" fill="${COLORS.value}" font-family="${MACHINE}"`,
    ` font-size="${VALUE_SIZE}" textLength="${valueW}" lengthAdjust="spacingAndGlyphs">`,
    `${esc(value)}</text>`,
    `</svg>\n`,
  ].join('')
}
