const XLINK_NS = 'http://www.w3.org/1999/xlink';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';
const CANONICAL_CAMEL_SVG_ATTRS = new Set([
    'accentHeight',
    'attributeName',
    'attributeType',
    'autoReverse',
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
]);
const SVG_ATTR_ALIASES = new Map();
for (let attr of CANONICAL_CAMEL_SVG_ATTRS) {
    SVG_ATTR_ALIASES.set(camelToKebab(attr), attr);
}
const NAMESPACED_SVG_ALIASES = new Map();
addNamespacedSvgAliases('xlink', XLINK_NS, 'href actuate arcrole role show title type');
addNamespacedSvgAliases('xml', XML_NS, 'base lang space');
addNamespacedSvgAliases('xmlns', undefined, 'xlink');
function addNamespacedSvgAliases(prefix, ns, names) {
    for (let name of names.split(' ')) {
        let attr = `${prefix}:${name}`;
        let alias = ns ? { ns, attr } : { attr };
        NAMESPACED_SVG_ALIASES.set(`${prefix}${name.charAt(0).toUpperCase()}${name.slice(1)}`, alias);
        NAMESPACED_SVG_ALIASES.set(attr, alias);
        NAMESPACED_SVG_ALIASES.set(`${prefix}-${name}`, alias);
    }
}
function normalizeSvgAttributeName(name) {
    let alias = SVG_ATTR_ALIASES.get(name);
    if (alias)
        return alias;
    if (CANONICAL_CAMEL_SVG_ATTRS.has(name))
        return name;
    return camelToKebab(name);
}
export function normalizeSvgAttribute(name) {
    let namespaced = NAMESPACED_SVG_ALIASES.get(name);
    if (namespaced) {
        return namespaced;
    }
    return { attr: normalizeSvgAttributeName(name) };
}
function camelToKebab(input) {
    return input
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/_/g, '-')
        .toLowerCase();
}
//# sourceMappingURL=svg-attributes.js.map