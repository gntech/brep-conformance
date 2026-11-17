import { describe, expect, it } from 'vitest'
import { point, shortCaseIds, testName, value } from './format'

describe('value', () => {
  it('writes counts whole, small values in exponent form, the rest to six figures', () => {
    expect(value(8)).toBe('8')
    expect(value(3700.244)).toBe('3700.24')
    expect(value(0.000776)).toBe('7.76e-4')
    expect(value(1e-7)).toBe('1.00e-7')
    expect(value(0)).toBe('0')
    expect(point([1.08, -12.7, 0.111])).toBe('1.08, -12.7, 0.111')
  })
})

describe('testName', () => {
  it('drops the top-level directory and reads hyphens as spaces', () => {
    expect(testName('booleans/overlap/spheres')).toBe('overlap / spheres')
    expect(testName('modify/offset-drilled-block-hole-fills')).toBe(
      'offset drilled block hole fills',
    )
  })
})

describe('shortCaseIds', () => {
  it('cuts the hash short and drops a family every id shares', () => {
    expect(shortCaseIds(['separated-b201c5cb8261410a', 'separated-64253debd143b5c0'])).toEqual([
      'b201c5',
      '64253d',
    ])
  })

  it('keeps the family where the ids are of more than one', () => {
    expect(shortCaseIds(['box-box-1a2b3c4d5e6f7a8b', 'box-sphere-0011223344556677'])).toEqual([
      'box-box 1a2b3c',
      'box-sphere 001122',
    ])
  })
})
