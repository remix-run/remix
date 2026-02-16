import { definePlugin } from '@remix-run/reconciler'

const STYLE_TEXT = Symbol('styleText')
type StyleMap = Map<string | typeof STYLE_TEXT, string>

export const stylePropsPlugin = definePlugin<Element>(() => (host) => {
  let current: StyleMap = new Map()

  return (input) => {
    if (!('style' in input.props) && current.size === 0) return input

    let next = toStyleMap(input.props.style)
    if ('style' in input.props) {
      delete input.props.style
    }

    host.queueTask((node) => {
      if (!(node instanceof Element) || !('style' in node)) return
      let styled = node as HTMLElement | SVGElement

      if (next.has(STYLE_TEXT)) {
        styled.style.cssText = next.get(STYLE_TEXT)!
        current = next
        return
      }
      if (current.has(STYLE_TEXT)) {
        styled.style.cssText = ''
      }

      for (let [key] of current) {
        if (typeof key !== 'string') continue
        if (next.has(key)) continue
        styled.style.removeProperty(key)
      }
      for (let [key, value] of next) {
        if (typeof key !== 'string') continue
        styled.style.setProperty(key, value)
      }
      current = next
    })

    return input
  }
})

function toStyleMap(value: unknown) {
  let next: StyleMap = new Map()
  if (typeof value === 'string') {
    next.set(STYLE_TEXT, value)
    return next
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return next
  let style = value as Record<string, unknown>
  for (let key in style) {
    let entry = style[key]
    if (entry == null || entry === false) continue
    next.set(toCssProperty(key), String(entry))
  }
  return next
}

function toCssProperty(name: string) {
  return name.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)
}
