import { invariant } from './invariant.ts'
import { createStyleManager, normalizeCssValue } from './style/index.ts'
import type { StyleManager } from './style/index.ts'
import type { ElementProps } from './jsx.ts'
import { normalizeSvgAttribute } from './svg-attributes.ts'

const SVG_NS = 'http://www.w3.org/2000/svg'

let globalStyleManager =
  typeof window !== 'undefined' ? createStyleManager() : (null as unknown as StyleManager)

export { type StyleManager }

export let defaultStyleManager: StyleManager = globalStyleManager

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
])

// Determine if we should use the property path for a given name.
// Also acts as a type guard to allow bracket assignment without casts.
function canUseProperty(
  dom: Element,
  name: string,
  isSvg: boolean,
): dom is Element & Record<string, unknown> {
  if (isSvg) return false
  if (ATTRIBUTE_FALLBACK_NAMES.has(name)) return false
  return name in dom
}

function isFrameworkProp(name: string): boolean {
  return (
    name === 'children' ||
    name === 'mix' ||
    name === 'key' ||
    name === 'setup' ||
    name === 'animate' ||
    name === 'innerHTML'
  )
}

// TODO: would rather actually diff el.style object directly instead of writing
// to the style attribute
function serializeStyleObject(style: Record<string, unknown>): string {
  let parts: string[] = []
  for (let [key, value] of Object.entries(style)) {
    if (value == null) continue
    if (typeof value === 'boolean') continue
    if (typeof value === 'number' && !Number.isFinite(value)) continue

    let cssKey = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)

    let cssValue = Array.isArray(value)
      ? (value as unknown[]).join(', ')
      : normalizeCssValue(key, value)

    parts.push(`${cssKey}: ${cssValue};`)
  }
  return parts.join(' ')
}

function normalizePropName(name: string, isSvg: boolean): { ns?: string; attr: string } {
  // aria-/data- pass through
  if (name.startsWith('aria-') || name.startsWith('data-')) return { attr: name }

  // DOM property -> HTML mappings
  if (!isSvg) {
    if (name === 'className') return { attr: 'class' }
    if (name === 'htmlFor') return { attr: 'for' }
    if (name === 'tabIndex') return { attr: 'tabindex' }
    if (name === 'acceptCharset') return { attr: 'accept-charset' }
    if (name === 'httpEquiv') return { attr: 'http-equiv' }
    return { attr: name.toLowerCase() }
  }

  return normalizeSvgAttribute(name)
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

function normalizeClassProps(props: ElementProps): ElementProps {
  if (!('class' in props) && !('className' in props)) return props

  let classAttr = typeof props.class === 'string' ? props.class : ''
  let className = typeof props.className === 'string' ? props.className : ''
  let mergedClassName =
    classAttr && className ? `${classAttr} ${className}` : classAttr || className
  let normalizedProps = { ...props }

  delete normalizedProps.class
  if (mergedClassName) {
    normalizedProps.className = mergedClassName
  } else {
    delete normalizedProps.className
  }

  return normalizedProps
}

export function diffHostProps(curr: ElementProps, next: ElementProps, dom: Element) {
  let isSvg = dom.namespaceURI === SVG_NS
  curr = normalizeClassProps(curr)
  next = normalizeClassProps(next)

  // Removals
  for (let name in curr) {
    if (isFrameworkProp(name)) continue
    if (!(name in next) || next[name] == null) {
      // Clear runtime state for form-like props where removing the attribute is not enough.
      if (canUseProperty(dom, name, isSvg)) {
        clearRuntimePropertyOnRemoval(dom, name)
      }

      let { ns, attr } = normalizePropName(name, isSvg)
      if (ns) dom.removeAttributeNS(ns, toLocalName(attr))
      else dom.removeAttribute(attr)
    }
  }

  // Additions/updates
  for (let name in next) {
    if (isFrameworkProp(name)) continue
    let nextValue = next[name]
    if (nextValue == null) continue
    let prevValue = curr[name]
    if (prevValue !== nextValue) {
      let { ns, attr } = normalizePropName(name, isSvg)

      // Object style: serialize to attribute for now
      if (
        attr === 'style' &&
        typeof nextValue === 'object' &&
        nextValue &&
        !Array.isArray(nextValue)
      ) {
        dom.setAttribute('style', serializeStyleObject(nextValue))
        continue
      }

      // Prefer property assignment when possible (HTML only, not SVG)
      if (canUseProperty(dom, name, isSvg)) {
        try {
          dom[name] = nextValue == null ? '' : nextValue
          continue
        } catch {}
      }

      // Attribute path
      if (typeof nextValue === 'function') {
        // Never serialize functions as attribute values
        continue
      }

      let isAriaOrData = name.startsWith('aria-') || name.startsWith('data-')
      if (nextValue != null && (nextValue !== false || isAriaOrData)) {
        // Special-case popover: true => presence only
        let attrValue = name === 'popover' && nextValue === true ? '' : String(nextValue)
        if (ns) dom.setAttributeNS(ns, attr, attrValue)
        else dom.setAttribute(attr, attrValue)
      } else {
        if (ns) dom.removeAttributeNS(ns, toLocalName(attr))
        else dom.removeAttribute(attr)
      }
    }
  }
}

/**
 * Reset the global style state. For testing only - not exported from index.ts.
 */
export function resetStyleState() {
  invariant(
    typeof window !== 'undefined',
    'resetStyleState() is only available in a browser environment',
  )
  globalStyleManager.dispose()
  globalStyleManager = createStyleManager()
  defaultStyleManager = globalStyleManager
}
