import { definePlugin } from '../types.ts'

export const styleProps = definePlugin(() => (host) => {
  let current = new Map<string, string>()

  return (input) => {
    if (!('style' in input.props) && current.size === 0) return input

    let next = toStyleMap(input.props.style)
    if ('style' in input.props) {
      delete input.props.style
    }

    host.queueTask((node) => {
      if (!(node instanceof HTMLElement)) return
      for (let [key] of current) {
        if (next.has(key)) continue
        node.style.removeProperty(key)
      }

      for (let [key, value] of next) {
        node.style.setProperty(key, value)
      }

      current = next
    })

    return input
  }
})

function toStyleMap(value: unknown) {
  let map = new Map<string, string>()
  if (!value || typeof value !== 'object' || Array.isArray(value)) return map
  let style = value as Record<string, unknown>
  for (let key in style) {
    let next = style[key]
    if (next == null || next === false) continue
    map.set(toCssProperty(key), String(next))
  }
  return map
}

function toCssProperty(name: string) {
  return name.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)
}
