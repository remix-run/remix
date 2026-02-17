import { definePlugin } from '@remix-run/reconciler'

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

export const domPropertyOrAttributePlugin = definePlugin<Element>(() => ({
  keys: '*',
  setup() {
    let currentValues: null | Map<string, unknown> = null
    let seenVersions: null | Map<string, number> = null
    let currentVersion = 0
    let commitKeys: string[] = []
    let commitValues: unknown[] = []

    return {
      commit(input, node) {
        commitKeys.length = 0
        commitValues.length = 0
        for (let key in input.props) {
          let value = input.props[key]
          if (!shouldHandleValue(value)) continue
          commitKeys.push(key)
          commitValues.push(value)
          delete input.props[key]
        }

        if (!currentValues) currentValues = new Map()
        if (!seenVersions) seenVersions = new Map()
        currentVersion++

        for (let index = 0; index < commitKeys.length; index++) {
          let key = commitKeys[index]
          let value = commitValues[index]
          seenVersions.set(key, currentVersion)
          if (currentValues.has(key) && currentValues.get(key) === value) continue
          setNodeValue(node, key, value)
          currentValues.set(key, value)
        }

        for (let [key] of currentValues) {
          if (seenVersions.get(key) === currentVersion) continue
          resetNodeValue(node, key)
          currentValues.delete(key)
        }
      },
      remove(node, reason) {
        if (reason === 'unmount') return
        if (!currentValues || currentValues.size === 0) return
        for (let [key] of currentValues) {
          resetNodeValue(node, key)
        }
        currentValues.clear()
        currentValues = null
        seenVersions?.clear()
        seenVersions = null
      },
    }
  },
}))

function shouldHandleValue(value: unknown) {
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
