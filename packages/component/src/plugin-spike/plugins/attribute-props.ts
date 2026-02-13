import { definePlugin } from '../types.ts'

type AttributeValue = true | string

export const attributeProps = definePlugin(() => (host) => {
  let current = new Set<string>()

  return (input) => {
    let next = new Map<string, AttributeValue>()

    for (let key in input.props) {
      let value = input.props[key]
      let normalized = normalizeAttributeValue(value)
      if (normalized !== null) {
        next.set(key, normalized)
      }
      delete input.props[key]
    }

    if (next.size === 0 && current.size === 0) return input

    host.queueTask((node) => {
      for (let name of current) {
        if (next.has(name)) continue
        node.removeAttribute(name)
      }

      for (let [name, value] of next) {
        if (value === true) {
          node.setAttribute(name, '')
        } else {
          node.setAttribute(name, value)
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
