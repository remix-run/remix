import { definePlugin } from '../types.ts'

type AriaValue = true | string

export const ariaProps = definePlugin(() => (host) => {
  let current = new Set<string>()

  return (input) => {
    let next = new Map<string, AriaValue>()
    for (let key in input.props) {
      if (!key.startsWith('aria-')) continue
      let value = normalizeAriaValue(input.props[key])
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

function normalizeAriaValue(value: unknown): null | AriaValue {
  if (value == null) return null
  if (value === false) return null
  if (value === true) return 'true'
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return String(value)
}
