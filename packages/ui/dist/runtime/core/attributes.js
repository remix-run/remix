import { normalizeCssValue, toCssPropertyName } from "../../style/properties.js";
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
export function canUseProperty(element, name, isSvg, attr) {
    if (isSvg)
        return false;
    if (ATTRIBUTE_FALLBACK_NAMES.has(name))
        return false;
    if (isBooleanishStringAttribute(attr))
        return false;
    return name in element;
}
export function normalizeAttributeName(name, isSvg) {
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
export function serializeStyleObject(style) {
    let parts = [];
    for (let [key, value] of Object.entries(style)) {
        let cssValue = styleValueToCss(key, value);
        if (cssValue === undefined)
            continue;
        let cssKey = toCssPropertyName(key);
        parts.push(`${cssKey}: ${cssValue};`);
    }
    return parts.join(' ');
}
export function styleValueToCss(name, value) {
    if (value == null)
        return undefined;
    if (typeof value === 'boolean')
        return undefined;
    if (typeof value === 'number' && !Number.isFinite(value))
        return undefined;
    if (Array.isArray(value)) {
        return value.join(', ');
    }
    return normalizeCssValue(name, value);
}
export function getMergedClassName(props) {
    let classAttr = typeof props.class === 'string' ? props.class : '';
    let className = typeof props.className === 'string' ? props.className : '';
    let merged = classAttr && className ? `${classAttr} ${className}` : classAttr || className;
    return merged || undefined;
}
//# sourceMappingURL=attributes.js.map