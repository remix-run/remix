import { definePlugin } from '@remix-run/reconciler'

const STYLE_TEXT = Symbol('styleText')
type StyleMap = Map<string | typeof STYLE_TEXT, string>

export const stylePropsPlugin = definePlugin<Element>(() => ({
  keys: ['style'],
  setup() {
    let current: null | StyleMap = null

    return {
      commit(input, node) {
        let next = toStyleMap(input.props.style)
        delete input.props.style

        if (!(node instanceof Element) || !('style' in node)) return
        let styled = node as HTMLElement | SVGElement
        if (!current) current = new Map()

        if (next.has(STYLE_TEXT)) {
          let nextText = next.get(STYLE_TEXT)!
          if (!(current.size === 1 && current.get(STYLE_TEXT) === nextText)) {
            styled.style.cssText = nextText
            current.clear()
            current.set(STYLE_TEXT, nextText)
          }
          return
        }
        if (current.has(STYLE_TEXT)) {
          styled.style.cssText = ''
          current.delete(STYLE_TEXT)
        }

        for (let [key] of current) {
          if (typeof key !== 'string') continue
          if (next.has(key)) continue
          styled.style.removeProperty(key)
        }
        for (let [key, value] of next) {
          if (typeof key !== 'string') continue
          if (current.get(key) === value) continue
          styled.style.setProperty(key, value)
        }
        current.clear()
        for (let [key, value] of next) {
          current.set(key, value)
        }
      },
      remove(node, reason) {
        if (reason === 'unmount') return
        if (!current || current.size === 0) return
        if (!(node instanceof Element) || !('style' in node)) return
        let styled = node as HTMLElement | SVGElement
        styled.style.cssText = ''
        current.clear()
        current = null
      },
    }
  },
}))

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
