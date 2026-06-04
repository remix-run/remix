import { canUseProperty, getMergedClassName, isBooleanishStringAttribute, normalizeAttributeName, serializeStyleObject, styleValueToCss, } from "./attributes.js";
import { toCssPropertyName } from "../../style/properties.js";
const SVG_NS = 'http://www.w3.org/2000/svg';
function isIgnoredProp(name) {
    return (name === 'children' ||
        name === 'mix' ||
        name === 'key' ||
        name === 'animate' ||
        name === 'innerHTML' ||
        name === 'on' ||
        name === 'class' ||
        name === 'className');
}
function toLocalName(attrName) {
    let separatorIndex = attrName.indexOf(':');
    if (separatorIndex === -1)
        return attrName;
    return attrName.slice(separatorIndex + 1);
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
/**
 * Patches DOM attributes and selected properties from old props to new props.
 *
 * @param curr Previous host props.
 * @param next Next host props.
 * @param dom Element to patch.
 */
export function patchHostProps(curr, next, dom) {
    let isSvg = dom.namespaceURI === SVG_NS;
    let currClassName = getMergedClassName(curr);
    let nextClassName = getMergedClassName(next);
    if (currClassName !== nextClassName) {
        if (nextClassName) {
            dom.setAttribute('class', nextClassName);
        }
        else {
            dom.removeAttribute('class');
        }
    }
    for (let name in curr) {
        if (isIgnoredProp(name))
            continue;
        if (name in next && next[name] != null)
            continue;
        let { ns, attr } = normalizeAttributeName(name, isSvg);
        if (canUseProperty(dom, name, isSvg, attr)) {
            clearRuntimePropertyOnRemoval(dom, name);
        }
        if (ns)
            dom.removeAttributeNS(ns, toLocalName(attr));
        else
            dom.removeAttribute(attr);
    }
    for (let name in next) {
        if (isIgnoredProp(name))
            continue;
        let nextValue = next[name];
        if (nextValue == null)
            continue;
        let prevValue = curr[name];
        if (prevValue === nextValue)
            continue;
        if (name === 'style' && isStyleObject(nextValue)) {
            if (isStyleObject(prevValue)) {
                patchStyleObject(dom, prevValue, nextValue);
            }
            else {
                dom.removeAttribute('style');
                patchStyleObject(dom, undefined, nextValue);
            }
            continue;
        }
        patchHostProp(dom, name, nextValue, isSvg);
    }
}
function patchHostProp(dom, name, value, isSvg) {
    let { ns, attr } = normalizeAttributeName(name, isSvg);
    if (attr === 'style' && isStyleObject(value)) {
        patchStyleObject(dom, undefined, value);
        return;
    }
    if (attr === 'style' && typeof value === 'string') {
        dom.setAttribute('style', value);
        return;
    }
    if (canUseProperty(dom, name, isSvg, attr)) {
        try {
            dom[name] = value == null ? '' : value;
            return;
        }
        catch { }
    }
    if (typeof value === 'function')
        return;
    let isAriaOrData = name.startsWith('aria-') || name.startsWith('data-');
    let isBooleanishString = isBooleanishStringAttribute(attr);
    if (value != null && (value !== false || isAriaOrData || isBooleanishString)) {
        let attrValue = name === 'popover' && value === true ? '' : String(value);
        if (ns)
            dom.setAttributeNS(ns, attr, attrValue);
        else
            dom.setAttribute(attr, attrValue);
    }
    else {
        if (ns)
            dom.removeAttributeNS(ns, toLocalName(attr));
        else
            dom.removeAttribute(attr);
    }
}
function isStyleObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function patchStyleObject(dom, curr, next) {
    if (!(dom instanceof HTMLElement || dom instanceof SVGElement)) {
        dom.setAttribute('style', serializeStyleObject(next));
        return;
    }
    let style = dom.style;
    if (curr) {
        for (let name in curr) {
            let nextCssValue = styleValueToCss(name, next[name]);
            if (nextCssValue !== undefined)
                continue;
            let prevCssValue = styleValueToCss(name, curr[name]);
            if (prevCssValue === undefined)
                continue;
            style.removeProperty(toCssPropertyName(name));
        }
    }
    for (let name in next) {
        let nextCssValue = styleValueToCss(name, next[name]);
        if (nextCssValue === undefined)
            continue;
        let prevCssValue = curr ? styleValueToCss(name, curr[name]) : undefined;
        if (prevCssValue === nextCssValue)
            continue;
        style.setProperty(toCssPropertyName(name), nextCssValue);
    }
}
//# sourceMappingURL=props.js.map