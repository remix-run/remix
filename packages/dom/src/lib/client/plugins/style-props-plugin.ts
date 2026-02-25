import { definePlugin } from '@remix-run/reconciler'

export let stylePropsPlugin = definePlugin<HTMLElement | SVGElement>(() => ({
  phase: 'special',
  priority: 1,
  keys: ['style'],
  shouldActivate(context) {
    return (
      typeof context.delta.nextProps.style === 'object' && context.delta.nextProps.style != null
    )
  },
  setup(handle) {
    let element = handle.host.node
    let previousStyle: null | Record<string, unknown> = null

    return {
      remove() {
        if (!previousStyle) return
        for (let key in previousStyle) {
          element.style.removeProperty(toCssPropertyName(key))
        }
        previousStyle = null
      },
      commit(context) {
        let nextStyle = context.delta.nextProps.style as Record<string, unknown>
        if (previousStyle === nextStyle) {
          context.consume('style')
          return
        }

        for (let key in nextStyle) {
          let value = nextStyle[key]
          if (previousStyle && previousStyle[key] === value) continue
          if (value == null) {
            element.style.removeProperty(toCssPropertyName(key))
            continue
          }
          element.style.setProperty(toCssPropertyName(key), toCssValue(key, value))
        }

        if (previousStyle) {
          for (let key in previousStyle) {
            if (key in nextStyle) continue
            element.style.removeProperty(toCssPropertyName(key))
          }
        }

        previousStyle = nextStyle
        context.consume('style')
      },
    }
  },
}))

function toCssPropertyName(value: string) {
  if (value.startsWith('--')) return value
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}

function toCssValue(key: string, value: unknown) {
  if (typeof value === 'number' && !isUnitlessProperty(key) && !key.startsWith('--')) {
    return `${value}px`
  }
  return String(value)
}

function isUnitlessProperty(key: string) {
  return (
    key === 'opacity' ||
    key === 'zIndex' ||
    key === 'fontWeight' ||
    key === 'lineHeight' ||
    key === 'flex' ||
    key === 'flexGrow' ||
    key === 'flexShrink' ||
    key === 'order'
  )
}
