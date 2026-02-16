import { definePlugin } from '@remix-run/reconciler'

type AttrValue = string

export const ariaDataAttributePlugin = definePlugin<Element>(() => (host) => {
  let current = new Set<string>()

  return (input) => {
    let next = new Map<string, AttrValue>()
    for (let key in input.props) {
      if (!key.startsWith('aria-') && !key.startsWith('data-')) continue
      let value = normalizeAttrValue(input.props[key], key)
      if (value !== null) next.set(key, value)
      delete input.props[key]
    }

    if (next.size === 0 && current.size === 0) return input

    host.queueTask((node) => {
      for (let key of current) {
        if (next.has(key)) continue
        node.removeAttribute(key)
      }
      for (let [key, value] of next) {
        node.setAttribute(key, value)
      }
      current = new Set(next.keys())
    })

    return input
  }
})

function normalizeAttrValue(value: unknown, key: string): null | AttrValue {
  if (value == null) return null
  // Match preact behavior where false is serialized for aria/data.
  if (value === false) return key.startsWith('data-') || key.startsWith('aria-') ? 'false' : null
  if (value === true) return 'true'
  return String(value)
}
