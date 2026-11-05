import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { normalizeSvgAttribute } from './svg-attributes.ts'

const XLINK_NS = 'http://www.w3.org/1999/xlink'
const XML_NS = 'http://www.w3.org/XML/1998/namespace'

describe('normalizeSvgAttribute', () => {
  it('maps every spelling of namespaced attributes to their qualified names', () => {
    let attributes = [
      ['xlink', 'href', 'Href', XLINK_NS],
      ['xlink', 'actuate', 'Actuate', XLINK_NS],
      ['xlink', 'arcrole', 'Arcrole', XLINK_NS],
      ['xlink', 'role', 'Role', XLINK_NS],
      ['xlink', 'show', 'Show', XLINK_NS],
      ['xlink', 'title', 'Title', XLINK_NS],
      ['xlink', 'type', 'Type', XLINK_NS],
      ['xml', 'base', 'Base', XML_NS],
      ['xml', 'lang', 'Lang', XML_NS],
      ['xml', 'space', 'Space', XML_NS],
    ]

    for (let [prefix, localName, camelName, ns] of attributes) {
      let expected = { ns, attr: `${prefix}:${localName}` }
      expect(normalizeSvgAttribute(prefix + camelName)).toEqual(expected)
      expect(normalizeSvgAttribute(`${prefix}:${localName}`)).toEqual(expected)
      expect(normalizeSvgAttribute(`${prefix}-${localName}`)).toEqual(expected)
    }
  })

  it('maps every spelling of xmlns:xlink without a namespace', () => {
    expect(normalizeSvgAttribute('xmlnsXlink')).toEqual({ attr: 'xmlns:xlink' })
    expect(normalizeSvgAttribute('xmlns:xlink')).toEqual({ attr: 'xmlns:xlink' })
    expect(normalizeSvgAttribute('xmlns-xlink')).toEqual({ attr: 'xmlns:xlink' })
  })

  it('does not namespace near-miss attribute names', () => {
    expect(normalizeSvgAttribute('xlinkHREF')).toEqual({ attr: 'xlink-href' })
    expect(normalizeSvgAttribute('xlink:Href')).toEqual({ attr: 'xlink:href' })
    expect(normalizeSvgAttribute('xlinkhref')).toEqual({ attr: 'xlinkhref' })
    expect(normalizeSvgAttribute('xlinkLang')).toEqual({ attr: 'xlink-lang' })
    expect(normalizeSvgAttribute('xmlHref')).toEqual({ attr: 'xml-href' })
    expect(normalizeSvgAttribute('xmlnsHref')).toEqual({ attr: 'xmlns-href' })
    expect(normalizeSvgAttribute('xlink_href')).toEqual({ attr: 'xlink-href' })
  })
})
