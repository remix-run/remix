import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import {
  isAllowedHostPropName,
  normalizeAttributeName,
  normalizeCssValue,
  patchHostProps,
  sanitizeUrlAttribute,
  serializeStyleObject,
} from './vdom.ts'
import { unsafeHTML } from './vnode.ts'

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

describe('normalizeAttributeName', () => {
  it('does not leak Object.prototype keys as HTML attribute renames', () => {
    expect(normalizeAttributeName('constructor', false)).toBe('constructor')
    expect(normalizeAttributeName('toString', false)).toBe('tostring')
    expect(normalizeAttributeName('valueOf', false)).toBe('valueof')
  })

  it('normalizes SVG attributes while preserving canonical camelCase and kebab-case names', () => {
    expect(normalizeAttributeName('viewBox', true)).toBe('viewBox')
    expect(normalizeAttributeName('clipPathUnits', true)).toBe('clipPathUnits')
    expect(normalizeAttributeName('stdDeviation', true)).toBe('stdDeviation')
    expect(normalizeAttributeName('stroke-linecap', true)).toBe('stroke-linecap')
    expect(normalizeAttributeName('strokeLinecap', true)).toBe('stroke-linecap')
    expect(normalizeAttributeName('strokeWidth', true)).toBe('stroke-width')
    expect(normalizeAttributeName('stopColor', true)).toBe('stop-color')
    expect(normalizeAttributeName('whiteSpace', true)).toBe('white-space')
    expect(normalizeAttributeName('xlinkHref', true)).toBe('href')
    expect(normalizeAttributeName('xlink:href', true)).toBe('href')
    expect(normalizeAttributeName('xlink:Href', true)).toBe('href')
    expect(normalizeAttributeName('XLINK:HREF', true)).toBe('href')
    expect(normalizeAttributeName('xlinkHelper', true)).toBe('xlinkHelper')
    expect(normalizeAttributeName('xlinkTitle', true)).toBe('xlink:title')
    expect(normalizeAttributeName('xlinkActuate', true)).toBe('xlink:actuate')
    expect(normalizeAttributeName('xlinkArcrole', true)).toBe('xlink:arcrole')
    expect(normalizeAttributeName('xlinkRole', true)).toBe('xlink:role')
    expect(normalizeAttributeName('xlinkShow', true)).toBe('xlink:show')
    expect(normalizeAttributeName('xlinkType', true)).toBe('xlink:type')
    expect(normalizeAttributeName('xlink:title', true)).toBe('xlink:title')
    expect(normalizeAttributeName('className', true)).toBe('class')
    expect(normalizeAttributeName('xmlLang', true)).toBe('xml:lang')
    expect(normalizeAttributeName('xml:lang', true)).toBe('xml:lang')
    expect(normalizeAttributeName('xmlSpace', true)).toBe('xml:space')
    expect(normalizeAttributeName('xmlnsXlink', true)).toBe('xmlns:xlink')
  })

  it('sanitizes executable URL attributes case-insensitively', () => {
    for (let attr of ['HREF', 'Href', 'xlink:Href', 'XLINK:HREF', 'SRC', 'ACTION']) {
      expect(String(sanitizeUrlAttribute('a', attr, 'javascript:alert(1)'))).toContain(
        'blocked a javascript: URL',
      )
    }
  })
})

describe('inline style normalization parity', () => {
  it('applies identical unitless and px rules on client and server', () => {
    let styles = {
      borderInlineWidth: 2,
      gridGap: 8,
      aspectRatio: 1.5,
      opacity: 0.5,
      '-webkit-border-radius': 4,
      '--gap': 12,
    }
    let serialized = serializeStyleObject(styles)
    expect(serialized).toContain('border-inline-width: 2px;')
    expect(serialized).toContain('grid-gap: 8px;')
    expect(serialized).toContain('aspect-ratio: 1.5;')
    expect(serialized).toContain('opacity: 0.5;')
    expect(serialized).toContain('-webkit-border-radius: 4px;')
    expect(serialized).toContain('--gap: 12;')

    let div = document.createElement('div')
    patchHostProps({}, { style: styles }, div)
    expect(div.style.borderInlineWidth).toBe('2px')
    expect(div.style.getPropertyValue('gap') || div.style.getPropertyValue('grid-gap')).toBe('8px')
    expect(div.style.aspectRatio).toBe('1.5 / 1')
    expect(div.style.opacity).toBe('0.5')
    expect(div.style.getPropertyValue('--gap')).toBe('12')

    expect(normalizeCssValue('webkit-line-clamp', 2)).toBe('2')
    expect(normalizeCssValue('WebkitLineClamp', 2)).toBe('2')
  })

  it('ignores reserved CSSStyleDeclaration members in style objects', () => {
    let div = document.createElement('div')
    patchHostProps(
      {},
      { style: { color: 'red', cssText: 'margin: 0', length: 1, setProperty: 'nope' } },
      div,
    )
    expect(div.style.color).toBe('red')
    expect(div.style.margin).toBe('')
    expect(typeof div.style.setProperty).toBe('function')
  })

  it('ignores inherited enumerable properties when serializing style objects', () => {
    let inherited = Object.create({ color: 'red' })
    inherited.backgroundColor = 'blue'
    expect(serializeStyleObject(inherited)).toBe('background-color: blue;')
  })

  it('falls back to style attribute on non-HTML/SVG elements', () => {
    let customNsEl = document.createElementNS('http://example.com/ns', 'box')
    patchHostProps({}, { style: { color: 'red', marginTop: 4 } }, customNsEl)
    expect(customNsEl.getAttribute('style')).toBe('color: red; margin-top: 4px;')
  })
})

describe('unsafeHTML brand integrity', () => {
  it('exposes no enumerable or symbol properties that can forge a brand', () => {
    let value = unsafeHTML('<b>ok</b>')
    expect(Object.keys(value)).toEqual([])
    expect(Object.getOwnPropertySymbols(value)).toEqual([])
  })
})
