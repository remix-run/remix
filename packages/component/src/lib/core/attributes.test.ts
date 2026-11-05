import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { isAllowedHostPropName } from './attributes.ts'

describe('isAllowedHostPropName', () => {
  it('blocks event prop names in every ASCII letter case', () => {
    expect(isAllowedHostPropName('onclick')).toBe(false)
    expect(isAllowedHostPropName('onClick')).toBe(false)
    expect(isAllowedHostPropName('OnClick')).toBe(false)
    expect(isAllowedHostPropName('oNclick')).toBe(false)
    expect(isAllowedHostPropName('ONCLICK')).toBe(false)
    expect(isAllowedHostPropName('on')).toBe(false)
  })

  it('keeps event names inside ordinary attribute names', () => {
    expect(isAllowedHostPropName('data-onclick')).toBe(true)
    expect(isAllowedHostPropName('aria-controls')).toBe(true)
    expect(isAllowedHostPropName('nonce')).toBe(true)
    expect(isAllowedHostPropName('className')).toBe(true)
  })

  it('blocks delimiters and reserved prop names', () => {
    expect(isAllowedHostPropName('')).toBe(false)
    expect(isAllowedHostPropName('__proto__')).toBe(false)
    expect(isAllowedHostPropName('outerHTML')).toBe(false)
    for (let character of ['\u0000', '\t', '\n', '\f', '\r', ' ', '"', "'", '/', '>', '=']) {
      expect(isAllowedHostPropName(`data${character}value`)).toBe(false)
    }
  })
})
