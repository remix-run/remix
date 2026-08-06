import { normalizeCssValue } from "../../style/style.js";
import { normalizeSvgAttribute } from "../svg-attributes.js";
const ATTRIBUTE_FALLBACK_NAMES = new Set([
    'width',
    'height',
    'href',
    'list',
    'form',
    'tabIndex',
    'download',
    'rowSpan',
    'colSpan',
    'role',
    'popover',
    'translate',
]);
const BOOLEANISH_STRING_ATTRIBUTES = new Set([
    'autoReverse',
    'contenteditable',
    'draggable',
    'externalResourcesRequired',
    'focusable',
    'preserveAlpha',
    'spellcheck',
]);
export const FRAMEWORK_PROPS = new Set(['children', 'mix', 'key', 'animate', 'innerHTML', 'on']);
export const SELF_CLOSING_TAGS = new Set([
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr',
]);
export function isChildlessElement(name) {
    return SELF_CLOSING_TAGS.has(name);
}
export function canUseProperty(element, name, isSvg, attr) {
    if (isSvg)
        return false;
    if (ATTRIBUTE_FALLBACK_NAMES.has(name))
        return false;
    if (isBooleanishStringAttribute(attr))
        return false;
    return name in element;
}
// Prop names repeat constantly across elements and renders; cache the
// normalized results so the string work and object allocation happen once
// per distinct name. Entries are shared — callers must not mutate them.
const NORMALIZATION_CACHE_LIMIT = 256;
const htmlAttributeNameCache = new Map();
const svgAttributeNameCache = new Map();
export function normalizeAttributeName(name, isSvg) {
    let cache = isSvg ? svgAttributeNameCache : htmlAttributeNameCache;
    let cached = cache.get(name);
    if (cached === undefined) {
        cached = computeAttributeName(name, isSvg);
        if (cache.size >= NORMALIZATION_CACHE_LIMIT) {
            let oldest = cache.keys().next();
            if (!oldest.done)
                cache.delete(oldest.value);
        }
        cache.set(name, cached);
    }
    return cached;
}
function computeAttributeName(name, isSvg) {
    if (name.startsWith('aria-') || name.startsWith('data-'))
        return { attr: name };
    if (name === 'className')
        return { attr: 'class' };
    if (!isSvg) {
        if (name === 'htmlFor')
            return { attr: 'for' };
        if (name === 'tabIndex')
            return { attr: 'tabindex' };
        if (name === 'acceptCharset')
            return { attr: 'accept-charset' };
        if (name === 'httpEquiv')
            return { attr: 'http-equiv' };
        return { attr: name.toLowerCase() };
    }
    return normalizeSvgAttribute(name);
}
export function isBooleanishStringAttribute(name) {
    return BOOLEANISH_STRING_ATTRIBUTES.has(name);
}
export function shouldStringifyBooleanAttribute(name) {
    return isBooleanishStringAttribute(name) || name === 'value';
}
export function serializeStyleObject(style) {
    let parts = [];
    for (let [key, value] of Object.entries(style)) {
        if (value == null)
            continue;
        if (typeof value === 'boolean')
            continue;
        if (typeof value === 'number' && !Number.isFinite(value))
            continue;
        let cssKey = toKebabCase(key);
        let cssValue = Array.isArray(value) ? value.join(', ') : normalizeCssValue(key, value);
        parts.push(`${cssKey}: ${cssValue};`);
    }
    return parts.join(' ');
}
export function getMergedClassName(props) {
    let classAttr = typeof props.class === 'string' ? props.class : '';
    let className = typeof props.className === 'string' ? props.className : '';
    let merged = classAttr && className ? `${classAttr} ${className}` : classAttr || className;
    return merged || undefined;
}
// Style/attribute names come from a small recurring set, so cache conversions
// instead of running a regex per property per element per render.
const kebabCaseCache = new Map();
export function toKebabCase(value) {
    let cached = kebabCaseCache.get(value);
    if (cached === undefined) {
        cached = value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
        if (kebabCaseCache.size >= NORMALIZATION_CACHE_LIMIT) {
            let oldest = kebabCaseCache.keys().next();
            if (!oldest.done)
                kebabCaseCache.delete(oldest.value);
        }
        kebabCaseCache.set(value, cached);
    }
    return cached;
}
//# sourceMappingURL=attributes.js.map