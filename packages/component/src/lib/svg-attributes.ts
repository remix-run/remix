const XLINK_NS = 'http://www.w3.org/1999/xlink'
const XML_NS = 'http://www.w3.org/XML/1998/namespace'

const CANONICAL_CAMEL_SVG_ATTRS = new Set([
  'viewBox',
  'preserveAspectRatio',
  'gradientUnits',
  'gradientTransform',
  'patternUnits',
  'patternContentUnits',
  'patternTransform',
  'clipPathUnits',
  'maskUnits',
  'maskContentUnits',
  'filterUnits',
  'primitiveUnits',
  'markerUnits',
])

const SVG_ATTR_ALIASES = new Map<string, string>()
for (let attr of CANONICAL_CAMEL_SVG_ATTRS) {
  SVG_ATTR_ALIASES.set(camelToKebab(attr), attr)
}

export function normalizeSvgAttributeName(name: string): string {
  let alias = SVG_ATTR_ALIASES.get(name)
  if (alias) return alias

  if (CANONICAL_CAMEL_SVG_ATTRS.has(name)) return name

  return camelToKebab(name)
}

export function normalizeSvgAttribute(
  name: string,
): {
  ns?: string
  attr: string
} {
  if (name === 'xlinkHref' || name === 'xlink:href') {
    return { ns: XLINK_NS, attr: 'xlink:href' }
  }

  if (name === 'xmlLang' || name === 'xml:lang') {
    return { ns: XML_NS, attr: 'xml:lang' }
  }

  if (name === 'xmlSpace' || name === 'xml:space') {
    return { ns: XML_NS, attr: 'xml:space' }
  }

  return { attr: normalizeSvgAttributeName(name) }
}

function camelToKebab(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase()
}
