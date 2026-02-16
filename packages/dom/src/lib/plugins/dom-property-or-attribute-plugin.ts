import { definePlugin } from '@remix-run/reconciler'
import type { Plugin } from '@remix-run/reconciler'

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

export const domPropertyOrAttributePlugin: Plugin<Element> = definePlugin(() => (host) => {
  let current = new Set<string>()

  return (input) => {
    let next = new Map<string, unknown>()
    for (let key in input.props) {
      let value = input.props[key]
      if (!shouldHandleValue(value)) continue
      next.set(key, value)
      delete input.props[key]
    }

    if (next.size === 0 && current.size === 0) return input

    host.queueTask((node) => {
      for (let key of current) {
        if (next.has(key)) continue
        resetNodeValue(node, key)
      }

      for (let [key, value] of next) {
        setNodeValue(node, key, value)
      }

      current = new Set(next.keys())
    })

    return input
  }
})

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
