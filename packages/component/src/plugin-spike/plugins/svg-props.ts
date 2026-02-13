import { definePlugin } from '../types.ts'

type SvgAttr = {
  name: string
  namespace: null | string
  value: true | string
}

let SVG_XLINK_NS = 'http://www.w3.org/1999/xlink'

let svgNameMap: Record<string, string> = {
  xlinkHref: 'xlink:href',
  strokeWidth: 'stroke-width',
  strokeLinecap: 'stroke-linecap',
  strokeLinejoin: 'stroke-linejoin',
  strokeMiterlimit: 'stroke-miterlimit',
  strokeDasharray: 'stroke-dasharray',
  strokeDashoffset: 'stroke-dashoffset',
  fillOpacity: 'fill-opacity',
  strokeOpacity: 'stroke-opacity',
  clipPath: 'clip-path',
  clipRule: 'clip-rule',
  stopColor: 'stop-color',
  stopOpacity: 'stop-opacity',
}

let preserveCaseNames = new Set(['viewBox', 'preserveAspectRatio'])
let svgTagNames = new Set([
  'svg',
  'g',
  'path',
  'circle',
  'rect',
  'line',
  'polyline',
  'polygon',
  'ellipse',
  'text',
  'defs',
  'use',
  'symbol',
  'clippath',
  'mask',
  'lineargradient',
  'radialgradient',
  'stop',
])

export const svgProps = definePlugin(() => (host) => {
  let current = new Set<string>()

  return (input) => {
    let next = new Map<string, SvgAttr>()

    for (let key in input.props) {
      let normalized = normalizeSvgName(key)
      if (!normalized) continue
      let value = input.props[key]
      if (value == null || value === false) {
        delete input.props[key]
        continue
      }
      if (typeof value === 'function') {
        delete input.props[key]
        continue
      }
      let attr: SvgAttr = {
        name: normalized,
        namespace: normalized === 'xlink:href' ? SVG_XLINK_NS : null,
        value: value === true ? true : String(value),
      }
      next.set(normalized, attr)
      delete input.props[key]
    }

    if (next.size === 0 && current.size === 0) return input

    host.queueTask((node) => {
      if (!isSvgNode(node)) return

      for (let name of current) {
        if (next.has(name)) continue
        if (name === 'xlink:href') {
          node.removeAttributeNS(SVG_XLINK_NS, 'href')
        } else {
          node.removeAttribute(name)
        }
      }

      for (let attr of next.values()) {
        if (attr.namespace) {
          node.setAttributeNS(attr.namespace, attr.name, attr.value === true ? '' : attr.value)
        } else {
          node.setAttribute(attr.name, attr.value === true ? '' : attr.value)
        }
      }

      current = new Set(next.keys())
    })

    return input
  }
})

function normalizeSvgName(name: string): null | string {
  if (name in svgNameMap) {
    return svgNameMap[name]
  }
  if (name.includes(':')) return name
  if (preserveCaseNames.has(name)) return name
  if (name.startsWith('data-') || name.startsWith('aria-')) return null
  if (name.includes('-')) return null
  if (!/[A-Z]/.test(name)) return null
  return name.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)
}

function isSvgNode(node: Element) {
  let name = node.tagName.toLowerCase()
  return svgTagNames.has(name)
}
