import { definePlugin } from '@remix-run/reconciler'

type AttributeValue = true | string

export const attributeFallbackPlugin = definePlugin<Element>(() => (host) => {
  let current = new Set<string>()

  return (input) => {
    let next = new Map<string, AttributeValue>()

    for (let key in input.props) {
      let value = normalizeAttributeValue(input.props[key])
      if (value !== null) {
        next.set(key, value)
      }
      delete input.props[key]
    }

    if (next.size === 0 && current.size === 0) return input

    host.queueTask((node) => {
      for (let key of current) {
        if (next.has(key)) continue
        node.removeAttribute(key)
      }
      for (let [key, value] of next) {
        if (value === true) {
          node.setAttribute(key, '')
        } else {
          node.setAttribute(key, value)
        }
      }
      current = new Set(next.keys())
    })

    return input
  }
})

function normalizeAttributeValue(value: unknown): null | AttributeValue {
  if (value == null) return null
  if (value === false) return null
  if (typeof value === 'function') return null
  if (typeof value === 'object') return null
  if (value === true) return true
  return String(value)
}
