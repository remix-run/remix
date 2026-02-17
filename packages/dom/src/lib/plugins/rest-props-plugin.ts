import { definePlugin } from '@remix-run/reconciler'

type AttrValue = string
type AttributeValue = true | string
const ENTRY_DOM = 0
const ENTRY_ATTR = 1
type RestEntry =
  | {
      mode: typeof ENTRY_DOM
      value: unknown
      seen: number
    }
  | {
      mode: typeof ENTRY_ATTR
      value: AttributeValue
      seen: number
    }

const attributeExceptions = new Set([
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

export const restPropsPlugin = definePlugin<Element>(() => ({
  keys: '*',
  setup() {
    let current: null | Map<string, RestEntry> = null
    let version = 0

    return {
      commit(input, node) {
        if (!hasOwnProperties(input.props) && current == null) return
        version++
        if (!current) current = new Map()

        for (let key in input.props) {
          let value = input.props[key]
          let nextMode: number | null = null
          let nextValue: unknown

          if (key.startsWith('aria-') || key.startsWith('data-')) {
            let normalized = normalizeAriaValue(value, key)
            if (normalized != null) {
              nextMode = ENTRY_ATTR
              nextValue = normalized
            }
            delete input.props[key]
          } else if (shouldHandleDomValue(value)) {
            nextMode = ENTRY_DOM
            nextValue = value
            delete input.props[key]
          } else {
            let normalized = normalizeAttributeValue(value)
            if (normalized != null) {
              nextMode = ENTRY_ATTR
              nextValue = normalized
            }
            delete input.props[key]
          }

          let prev = current.get(key)
          if (nextMode == null) {
            if (!prev) continue
            clearEntry(node, key, prev)
            current.delete(key)
            continue
          }

          if (prev && prev.mode === nextMode && prev.value === nextValue) {
            prev.seen = version
            continue
          }

          if (prev) {
            clearEntry(node, key, prev)
            prev.mode = nextMode as typeof ENTRY_DOM | typeof ENTRY_ATTR
            prev.value = nextValue
            prev.seen = version
            applyEntry(node, key, prev)
            continue
          }

          if (nextMode === ENTRY_DOM) {
            let created: RestEntry = { mode: ENTRY_DOM, value: nextValue, seen: version }
            applyEntry(node, key, created)
            current.set(key, created)
          } else {
            let created: RestEntry = {
              mode: ENTRY_ATTR,
              value: nextValue as AttributeValue,
              seen: version,
            }
            applyEntry(node, key, created)
            current.set(key, created)
          }
        }

        for (let [key, entry] of current) {
          if (entry.seen === version) continue
          clearEntry(node, key, entry)
          current.delete(key)
        }
      },
      remove(node, reason) {
        if (reason === 'unmount') return
        if (!current) return
        for (let [key, entry] of current) {
          clearEntry(node, key, entry)
        }
        current.clear()
        current = null
      },
    }
  },
}))

function normalizeAriaValue(value: unknown, key: string): null | AttrValue {
  if (value == null) return null
  // Match preact behavior where false is serialized for aria/data.
  if (value === false) return key.startsWith('data-') || key.startsWith('aria-') ? 'false' : null
  if (value === true) return 'true'
  return String(value)
}

function shouldHandleDomValue(value: unknown) {
  if (typeof value === 'function') return false
  if (typeof value === 'object' && value !== null) return false
  return true
}

function shouldUseProperty(node: Element, key: string) {
  if (key.includes('-') || key.includes(':')) return false
  if (attributeExceptions.has(key)) return false
  return key in (node as unknown as Record<string, unknown>)
}

function setNodeValue(node: Element, key: string, value: unknown) {
  if (shouldUseProperty(node, key)) {
    try {
      ;(node as unknown as Record<string, unknown>)[key] = value == null ? '' : value
      return
    } catch {
      // Fallback to attribute below.
    }
  }

  if (value == null || value === false) {
    node.removeAttribute(key)
    return
  }
  if (value === true) {
    node.setAttribute(key, '')
    return
  }
  node.setAttribute(key, String(value))
}

function resetNodeValue(node: Element, key: string) {
  if (shouldUseProperty(node, key)) {
    try {
      ;(node as unknown as Record<string, unknown>)[key] = ''
      return
    } catch {
      // Fallback to attribute removal below.
    }
  }
  node.removeAttribute(key)
}

function normalizeAttributeValue(value: unknown): null | AttributeValue {
  if (value == null) return null
  if (value === false) return null
  if (typeof value === 'function') return null
  if (typeof value === 'object') return null
  if (value === true) return true
  return String(value)
}

function applyEntry(node: Element, key: string, entry: RestEntry) {
  if (entry.mode === ENTRY_DOM) {
    setNodeValue(node, key, entry.value)
    return
  }
  if (entry.value === true) {
    node.setAttribute(key, '')
    return
  }
  node.setAttribute(key, entry.value)
}

function clearEntry(node: Element, key: string, entry: RestEntry) {
  if (entry.mode === ENTRY_DOM) {
    resetNodeValue(node, key)
    return
  }
  node.removeAttribute(key)
}

function hasOwnProperties(value: Record<string, unknown>) {
  for (let key in value) {
    if (Object.prototype.hasOwnProperty.call(value, key)) return true
  }
  return false
}
