const XLINK_NS = 'http://www.w3.org/1999/xlink'
const XML_NS = 'http://www.w3.org/XML/1998/namespace'

const CANONICAL_CAMEL_SVG_ATTRS = new Set([
  'accentHeight',
  'attributeName',
  'attributeType',
  'baseFrequency',
  'baseProfile',
  'calcMode',
  'viewBox',
  'preserveAspectRatio',
  'externalResourcesRequired',
  'filterRes',
  'gradientUnits',
  'gradientTransform',
  'glyphRef',
  'kernelMatrix',
  'kernelUnitLength',
  'keyPoints',
  'keySplines',
  'keyTimes',
  'lengthAdjust',
  'limitingConeAngle',
  'markerHeight',
  'patternUnits',
  'patternContentUnits',
  'patternTransform',
  'markerWidth',
  'numOctaves',
  'pathLength',
  'pointsAtX',
  'pointsAtY',
  'pointsAtZ',
  'preserveAlpha',
  'clipPathUnits',
  'maskUnits',
  'maskContentUnits',
  'filterUnits',
  'primitiveUnits',
  'refX',
  'refY',
  'requiredExtensions',
  'requiredFeatures',
  'specularConstant',
  'specularExponent',
  'spreadMethod',
  'startOffset',
  'stdDeviation',
  'stitchTiles',
  'surfaceScale',
  'systemLanguage',
  'tableValues',
  'targetX',
  'targetY',
  'textLength',
  'viewTarget',
  'xChannelSelector',
  'yChannelSelector',
  'zoomAndPan',
  'edgeMode',
  'diffuseConstant',
  'markerUnits',
])

const SVG_ATTR_ALIASES = new Map<string, string>()
for (let attr of CANONICAL_CAMEL_SVG_ATTRS) {
  SVG_ATTR_ALIASES.set(camelToKebab(attr), attr)
}

const NAMESPACED_SVG_ALIASES = new Map([
  ['xlinkHref', { ns: XLINK_NS, attr: 'xlink:href' }],
  ['xlink:href', { ns: XLINK_NS, attr: 'xlink:href' }],
  ['xlink-href', { ns: XLINK_NS, attr: 'xlink:href' }],
  ['xlinkActuate', { ns: XLINK_NS, attr: 'xlink:actuate' }],
  ['xlink:actuate', { ns: XLINK_NS, attr: 'xlink:actuate' }],
  ['xlink-actuate', { ns: XLINK_NS, attr: 'xlink:actuate' }],
  ['xlinkArcrole', { ns: XLINK_NS, attr: 'xlink:arcrole' }],
  ['xlink:arcrole', { ns: XLINK_NS, attr: 'xlink:arcrole' }],
  ['xlink-arcrole', { ns: XLINK_NS, attr: 'xlink:arcrole' }],
  ['xlinkRole', { ns: XLINK_NS, attr: 'xlink:role' }],
  ['xlink:role', { ns: XLINK_NS, attr: 'xlink:role' }],
  ['xlink-role', { ns: XLINK_NS, attr: 'xlink:role' }],
  ['xlinkShow', { ns: XLINK_NS, attr: 'xlink:show' }],
  ['xlink:show', { ns: XLINK_NS, attr: 'xlink:show' }],
  ['xlink-show', { ns: XLINK_NS, attr: 'xlink:show' }],
  ['xlinkTitle', { ns: XLINK_NS, attr: 'xlink:title' }],
  ['xlink:title', { ns: XLINK_NS, attr: 'xlink:title' }],
  ['xlink-title', { ns: XLINK_NS, attr: 'xlink:title' }],
  ['xlinkType', { ns: XLINK_NS, attr: 'xlink:type' }],
  ['xlink:type', { ns: XLINK_NS, attr: 'xlink:type' }],
  ['xlink-type', { ns: XLINK_NS, attr: 'xlink:type' }],
  ['xmlBase', { ns: XML_NS, attr: 'xml:base' }],
  ['xml:base', { ns: XML_NS, attr: 'xml:base' }],
  ['xml-base', { ns: XML_NS, attr: 'xml:base' }],
  ['xmlLang', { ns: XML_NS, attr: 'xml:lang' }],
  ['xml:lang', { ns: XML_NS, attr: 'xml:lang' }],
  ['xml-lang', { ns: XML_NS, attr: 'xml:lang' }],
  ['xmlSpace', { ns: XML_NS, attr: 'xml:space' }],
  ['xml:space', { ns: XML_NS, attr: 'xml:space' }],
  ['xml-space', { ns: XML_NS, attr: 'xml:space' }],
  ['xmlnsXlink', { attr: 'xmlns:xlink' }],
  ['xmlns:xlink', { attr: 'xmlns:xlink' }],
  ['xmlns-xlink', { attr: 'xmlns:xlink' }],
])

export function normalizeSvgAttributeName(name: string): string {
  let alias = SVG_ATTR_ALIASES.get(name)
  if (alias) return alias

  if (CANONICAL_CAMEL_SVG_ATTRS.has(name)) return name

  return camelToKebab(name)
}

export function normalizeSvgAttribute(name: string): {
  ns?: string
  attr: string
} {
  let namespaced = NAMESPACED_SVG_ALIASES.get(name)
  if (namespaced) {
    return namespaced
  }

  return { attr: normalizeSvgAttributeName(name) }
}

function camelToKebab(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase()
}
