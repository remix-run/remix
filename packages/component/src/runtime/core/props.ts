import type { ElementProps } from './vnode.ts'
import {
  canUseProperty,
  getMergedClassName,
  isAllowedHostPropName,
  normalizeAttributeName,
  sanitizeUrlAttribute,
  serializeStyleObject,
  shouldStringifyBooleanAttribute,
  styleValueToCss,
} from './attributes.ts'
import { camelToKebab } from '../../style/style.ts'

const SVG_NS = 'http://www.w3.org/2000/svg'

// Style objects can be mutated in place between renders, so each element records the style values
// it last applied and diffs against those instead of the previous props' object. Object values
// (arrays) are recorded as their CSS string so in-place mutations of them are seen too.
const APPLIED_STYLE = Symbol('AppliedStyle')
type StyledElement = Element & { [APPLIED_STYLE]?: Record<string, unknown> }

function isFrameworkProp(name: string): boolean {
  return (
    name === 'children' ||
    name === 'mix' ||
    name === 'key' ||
    name === 'animate' ||
    name === 'innerHTML' ||
    name === 'on'
  )
}

function toLocalName(attrName: string): string {
  let separatorIndex = attrName.indexOf(':')
  if (separatorIndex === -1) return attrName
  return attrName.slice(separatorIndex + 1)
}

function clearRuntimePropertyOnRemoval(dom: Element & Record<string, unknown>, name: string): void {
  try {
    if (name === 'value' || name === 'defaultValue') {
      dom[name] = ''
      return
    }
    if (name === 'checked' || name === 'defaultChecked' || name === 'selected') {
      dom[name] = false
      return
    }
    if (name === 'selectedIndex') {
      dom[name] = -1
    }
  } catch {}
}

/**
 * Patches DOM attributes and selected properties from old props to new props.
 *
 * @param curr Previous host props.
 * @param next Next host props.
 * @param dom Element to patch.
 */
export function patchHostProps(curr: ElementProps, next: ElementProps, dom: Element): void {
  let isSvg = dom.namespaceURI === SVG_NS
  let wasMultiple = dom instanceof HTMLSelectElement ? dom.multiple : undefined
  let currClassName = getMergedClassName(curr)
  let nextClassName = getMergedClassName(next)

  if (currClassName !== nextClassName) {
    if (nextClassName) {
      dom.setAttribute('class', nextClassName)
    } else {
      dom.removeAttribute('class')
    }
  }

  for (let name in curr) {
    if (isFrameworkProp(name)) continue
    if (name === 'defaultValue' && dom instanceof HTMLSelectElement) continue
    if (name === 'value' && dom instanceof HTMLSelectElement && curr.value === undefined) continue
    if (!isAllowedHostPropName(name)) continue
    if (name === 'class' || name === 'className') continue
    if (name in next && next[name] != null) continue

    let { ns, attr } = normalizeAttributeName(name, isSvg)
    if (canUseProperty(dom, name, isSvg, attr)) {
      clearRuntimePropertyOnRemoval(dom, name)
    }

    if (ns) dom.removeAttributeNS(ns, toLocalName(attr))
    else dom.removeAttribute(attr)
  }

  for (let name in next) {
    if (isFrameworkProp(name)) continue
    if (name === 'defaultValue' && dom instanceof HTMLSelectElement) continue
    if (!isAllowedHostPropName(name)) continue
    if (name === 'class' || name === 'className') continue

    let nextValue = next[name]
    if (nextValue == null) continue

    let prevValue = curr[name]
    if (name === 'style' && isStyleObject(nextValue)) {
      let isPatch = isStyleObject(prevValue)
      if (!isPatch) dom.removeAttribute('style')
      patchStyleObject(dom, nextValue, isPatch)
      continue
    }

    let sameObject = prevValue === nextValue
    if (sameObject && typeof nextValue !== 'object') continue

    patchHostProp(dom, name, nextValue, isSvg, sameObject)
  }

  if (dom instanceof HTMLSelectElement && wasMultiple !== dom.multiple && next.value == null) {
    setSelectDefaultValue(dom, next.defaultValue)
  }
}

// Objects can be mutated in place, so a prop that receives the same object is compared with what
// the DOM holds instead of skipped.
function patchHostProp(
  dom: Element,
  name: string,
  value: unknown,
  isSvg: boolean,
  sameObject = false,
): void {
  let { ns, attr } = normalizeAttributeName(name, isSvg)
  value = sanitizeUrlAttribute(dom.localName, attr, value)

  if (name === 'value' && dom instanceof HTMLSelectElement) {
    setSelectValue(dom, value)
    return
  }

  if (attr === 'style' && isStyleObject(value)) {
    patchStyleObject(dom, value, false)
    return
  }

  if (attr === 'style' && typeof value === 'string') {
    dom.setAttribute('style', value)
    return
  }

  if (canUseProperty(dom, name, isSvg, attr)) {
    // Reassigning some properties, like `srcObject`, reloads the element even for the same object.
    if (sameObject && dom[name] === value) return
    try {
      dom[name] = value == null ? '' : value
      return
    } catch {}
  }

  if (typeof value === 'function') return

  // Match server rendering: booleans render as "true"/"false" only for attributes that read them as
  // strings; otherwise `true` renders an empty attribute and `false` omits it.
  let stringify = typeof value !== 'boolean' || shouldStringifyBooleanAttribute(attr)
  if (value != null && (stringify || value)) {
    let attrValue = stringify ? String(value) : ''
    if (sameObject && dom.getAttribute(attr) === attrValue) return
    if (ns) dom.setAttributeNS(ns, attr, attrValue)
    else dom.setAttribute(attr, attrValue)
  } else {
    if (ns) dom.removeAttributeNS(ns, toLocalName(attr))
    else dom.removeAttribute(attr)
  }
}

function isStyleObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function patchStyleObject(dom: Element, next: Record<string, unknown>, isPatch: boolean): void {
  if (!(dom instanceof HTMLElement || dom instanceof SVGElement)) {
    let cssText = serializeStyleObject(next)
    if (dom.getAttribute('style') !== cssText) dom.setAttribute('style', cssText)
    return
  }

  let style = dom.style
  let applied = isPatch ? (dom as StyledElement)[APPLIED_STYLE] : undefined
  if (applied) {
    for (let name in applied) {
      let value = next[name]
      if (value === applied[name] || styleValueToCss(name, value) !== undefined) continue
      style.removeProperty(camelToKebab(name))
      delete applied[name]
    }
  } else {
    applied = {}
    ;(dom as StyledElement)[APPLIED_STYLE] = applied
  }

  for (let name in next) {
    let value = next[name]
    if (value === applied[name]) continue

    let cssValue = styleValueToCss(name, value)
    if (cssValue === undefined) continue
    if (typeof value === 'object') {
      if (applied[name] === cssValue) continue
      applied[name] = cssValue
    } else {
      applied[name] = value
    }
    style.setProperty(camelToKebab(name), cssValue)
  }
}

export function getSelectValues(value: unknown): Set<string> | undefined {
  if (value == null) return undefined
  return new Set(Array.isArray(value) ? value.map(String) : [String(value)])
}

export function setSelectDefaultValue(
  select: HTMLSelectElement,
  value: unknown,
  scalar = !select.multiple,
): void {
  let values = getSelectValues(value)
  let options = Array.from(select.options)
  let matched = false
  for (let option of options) {
    let selected = (values?.has(option.value) ?? false) && !(scalar && matched)
    if (selected) matched = true
    option.defaultSelected = selected
    option.selected = selected
  }
  if (!select.multiple && !matched) {
    let firstEnabled = options.find((option) => !option.disabled)
    if (firstEnabled) firstEnabled.selected = true
  }
}

export function setSelectValue(select: HTMLSelectElement, value: unknown): void {
  if (!select.multiple || !Array.isArray(value)) {
    select.value = value == null ? '' : String(value)
    return
  }
  let values = getSelectValues(value)
  for (let option of select.options) option.selected = values?.has(option.value) ?? false
}
