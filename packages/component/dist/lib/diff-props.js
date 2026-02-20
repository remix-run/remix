import { invariant } from "./invariant.js";
import { processStyle, createStyleManager, normalizeCssValue } from "./style/index.js";
const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';
// global so all roots share it
let styleCache = new Map();
let globalStyleManager = typeof window !== 'undefined' ? createStyleManager() : null;
export {};
export let defaultStyleManager = globalStyleManager;
export function cleanupCssProps(props, styles) {
    if (!props?.css)
        return;
    let { selector } = processStyle(props.css, styleCache);
    if (selector) {
        ;
        (styles ?? globalStyleManager).remove(selector);
    }
}
function diffCssProp(curr, next, dom, styles) {
    let prevSelector = curr.css ? processStyle(curr.css, styleCache).selector : '';
    let { selector: nextSelector, css } = next.css
        ? processStyle(next.css, styleCache)
        : { selector: '', css: '' };
    if (prevSelector === nextSelector)
        return;
    // Remove old CSS
    if (prevSelector) {
        dom.removeAttribute('data-css');
        styles.remove(prevSelector);
    }
    // Add new CSS
    if (css && nextSelector) {
        dom.setAttribute('data-css', nextSelector);
        styles.insert(nextSelector, css);
    }
}
// Preact excludes certain attributes from the property path due to browser quirks
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
]);
// Determine if we should use the property path for a given name.
// Also acts as a type guard to allow bracket assignment without casts.
function canUseProperty(dom, name, isSvg) {
    if (isSvg)
        return false;
    if (ATTRIBUTE_FALLBACK_NAMES.has(name))
        return false;
    return name in dom;
}
function isFrameworkProp(name) {
    return (name === 'children' ||
        name === 'key' ||
        name === 'on' ||
        name === 'css' ||
        name === 'setup' ||
        name === 'connect' ||
        name === 'animate' ||
        name === 'innerHTML');
}
// TODO: would rather actually diff el.style object directly instead of writing
// to the style attribute
function serializeStyleObject(style) {
    let parts = [];
    for (let [key, value] of Object.entries(style)) {
        if (value == null)
            continue;
        if (typeof value === 'boolean')
            continue;
        if (typeof value === 'number' && !Number.isFinite(value))
            continue;
        let cssKey = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
        let cssValue = Array.isArray(value)
            ? value.join(', ')
            : normalizeCssValue(key, value);
        parts.push(`${cssKey}: ${cssValue};`);
    }
    return parts.join(' ');
}
function normalizePropName(name, isSvg) {
    // aria-/data- pass through
    if (name.startsWith('aria-') || name.startsWith('data-'))
        return { attr: name };
    // DOM property -> HTML mappings
    if (!isSvg) {
        if (name === 'className')
            return { attr: 'class' };
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
    // SVG namespaced specials
    if (name === 'xlinkHref')
        return { ns: XLINK_NS, attr: 'xlink:href' };
    if (name === 'xmlLang')
        return { ns: XML_NS, attr: 'xml:lang' };
    if (name === 'xmlSpace')
        return { ns: XML_NS, attr: 'xml:space' };
    // SVG preserved-case exceptions
    if (name === 'viewBox' ||
        name === 'preserveAspectRatio' ||
        name === 'gradientUnits' ||
        name === 'gradientTransform' ||
        name === 'patternUnits' ||
        name === 'patternTransform' ||
        name === 'clipPathUnits' ||
        name === 'maskUnits' ||
        name === 'maskContentUnits') {
        return { attr: name };
    }
    // General SVG: kebab-case
    return { attr: camelToKebab(name) };
}
function camelToKebab(input) {
    return input
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/_/g, '-')
        .toLowerCase();
}
function clearRuntimePropertyOnRemoval(dom, name) {
    try {
        if (name === 'value' || name === 'defaultValue') {
            dom[name] = '';
            return;
        }
        if (name === 'checked' || name === 'defaultChecked' || name === 'selected') {
            dom[name] = false;
            return;
        }
        if (name === 'selectedIndex') {
            dom[name] = -1;
        }
    }
    catch { }
}
export function diffHostProps(curr, next, dom, styles) {
    let isSvg = dom.namespaceURI === SVG_NS;
    if (next.css || curr.css) {
        diffCssProp(curr, next, dom, styles ?? globalStyleManager);
    }
    // Removals
    for (let name in curr) {
        if (isFrameworkProp(name))
            continue;
        if (!(name in next) || next[name] == null) {
            // Clear runtime state for form-like props where removing the attribute is not enough.
            if (canUseProperty(dom, name, isSvg)) {
                clearRuntimePropertyOnRemoval(dom, name);
            }
            let { ns, attr } = normalizePropName(name, isSvg);
            if (ns)
                dom.removeAttributeNS(ns, attr);
            else
                dom.removeAttribute(attr);
        }
    }
    // Additions/updates
    for (let name in next) {
        if (isFrameworkProp(name))
            continue;
        let nextValue = next[name];
        if (nextValue == null)
            continue;
        let prevValue = curr[name];
        if (prevValue !== nextValue) {
            let { ns, attr } = normalizePropName(name, isSvg);
            // Object style: serialize to attribute for now
            if (attr === 'style' &&
                typeof nextValue === 'object' &&
                nextValue &&
                !Array.isArray(nextValue)) {
                dom.setAttribute('style', serializeStyleObject(nextValue));
                continue;
            }
            // Prefer property assignment when possible (HTML only, not SVG)
            if (canUseProperty(dom, name, isSvg)) {
                try {
                    dom[name] = nextValue == null ? '' : nextValue;
                    continue;
                }
                catch { }
            }
            // Attribute path
            if (typeof nextValue === 'function') {
                // Never serialize functions as attribute values
                continue;
            }
            let isAriaOrData = name.startsWith('aria-') || name.startsWith('data-');
            if (nextValue != null && (nextValue !== false || isAriaOrData)) {
                // Special-case popover: true => presence only
                let attrValue = name === 'popover' && nextValue === true ? '' : String(nextValue);
                if (ns)
                    dom.setAttributeNS(ns, attr, attrValue);
                else
                    dom.setAttribute(attr, attrValue);
            }
            else {
                if (ns)
                    dom.removeAttributeNS(ns, attr);
                else
                    dom.removeAttribute(attr);
            }
        }
    }
}
/**
 * Reset the global style state. For testing only - not exported from index.ts.
 */
export function resetStyleState() {
    styleCache.clear();
    invariant(typeof window !== 'undefined', 'resetStyleState() is only available in a browser environment');
    globalStyleManager.dispose();
    globalStyleManager = createStyleManager();
    defaultStyleManager = globalStyleManager;
}
//# sourceMappingURL=diff-props.js.map