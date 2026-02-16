import { definePlugin } from '@remix-run/reconciler'
import type { Plugin } from '@remix-run/reconciler'

const svgNameMap: Record<string, string> = {
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
  className: 'class',
}

export const svgNormalizationPlugin: Plugin<Element> = definePlugin(() => () => (input) => {
  for (let key in input.props) {
    if (!(key in svgNameMap)) continue
    let normalized = svgNameMap[key]
    if (!(normalized in input.props)) {
      input.props[normalized] = input.props[key]
    }
    delete input.props[key]
  }
  return input
})
