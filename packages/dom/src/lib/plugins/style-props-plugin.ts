import { definePlugin } from '@remix-run/reconciler'
import type { Plugin } from '@remix-run/reconciler'
import type {
  DomElementNode,
  DomNode,
  DomParentNode,
  DomTextNode,
} from '../dom-node-policy.ts'

export let stylePropsPlugin: Plugin<DomParentNode, DomNode, DomTextNode, DomElementNode> =
  definePlugin({
    phase: 'special',
    priority: 1,
    routing: { keys: ['style'] },
    shouldActivate(context) {
      return (
        typeof context.delta.nextProps.style === 'object' && context.delta.nextProps.style != null
      )
    },
    setup(handle) {
      let element = handle.host.node as HTMLElement
      let previousStyle: null | Record<string, unknown> = null

      handle.signal.addEventListener('abort', () => {
        if (!previousStyle) return
        for (let key in previousStyle) {
          element.style.removeProperty(toCssPropertyName(key))
        }
        previousStyle = null
      })

      return (context) => {
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
          element.style.setProperty(toCssPropertyName(key), String(value))
        }

        if (previousStyle) {
          for (let key in previousStyle) {
            if (key in nextStyle) continue
            element.style.removeProperty(toCssPropertyName(key))
          }
        }

        previousStyle = nextStyle
        context.consume('style')
      }
    },
  })

function toCssPropertyName(value: string) {
  if (value.startsWith('--')) return value
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}
