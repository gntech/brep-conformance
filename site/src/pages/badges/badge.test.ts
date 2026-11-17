import { describe, expect, it } from 'vitest'
import { badgeText, HEIGHT, monoWidth, renderBadge, sansWidth } from './badge'

const attr = (svg: string, name: string) => [...svg.matchAll(new RegExp(` ${name}="([^"]+)"`, 'g'))]

describe('the badge', () => {
  it('states the 1e-7 pass rate to one decimal', () => {
    expect(badgeText('occt', 0.8734).value).toBe('87.3% @ 1e-7')
    expect(badgeText('occt', 1).value).toBe('100.0% @ 1e-7')
    expect(badgeText('occt', 0).value).toBe('0.0% @ 1e-7')
  })

  it('names the suite in the title only when it is not the current one', () => {
    expect(badgeText('occt', 0.5).title).not.toContain('suite')
    expect(badgeText('occt', 0.5, '0.9.0').title).toContain('on suite 0.9.0')
  })

  it('measures text from fixed metrics', () => {
    expect(monoWidth('87.3%', 10)).toBe(30)
    expect(sansWidth('0', 10)).toBeCloseTo(5.56)
    expect(sansWidth('ii', 10)).toBeLessThan(sansWidth('MM', 10))
  })

  it('is shields height, sized to its text, and pins every run to its measured width', () => {
    const svg = renderBadge(badgeText('occt', 0.873))
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="\d+" height="20"/)
    expect(HEIGHT).toBe(20)
    const width = Number(attr(svg, 'width')[0]![1])
    const texts = attr(svg, 'textLength').map(m => Number(m[1]))
    const xs = attr(svg, 'x').map(m => Number(m[1]))
    expect(texts).toHaveLength(2)
    expect(xs.at(-1)! + texts[1]!).toBeLessThan(width)
    expect(svg).toContain('>87.3% @ 1e-7</text>')
    expect(svg).toContain('>BREP-CONFORMANCE</text>')
    expect(svg).not.toMatch(/@import|@font-face|href=/)
  })

  it('looks the same for every kernel but its number', () => {
    const a = renderBadge(badgeText('occt', 0.5))
    const b = renderBadge(badgeText('a-much-longer-kernel-name', 0.5))
    const strip = (s: string) => s.replace(/<title>.*<\/title>|aria-label="[^"]*"/g, '')
    expect(strip(a)).toBe(strip(b))
  })

  it('escapes the kernel name', () => {
    const svg = renderBadge(badgeText('a&b"<c>', 0.5))
    expect(svg).toContain('a&#38;b&#34;&#60;c&#62;')
    expect(svg).not.toContain('a&b')
  })
})
