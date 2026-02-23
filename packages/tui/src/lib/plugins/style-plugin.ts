import { definePlugin } from '@remix-run/reconciler'
import type { Plugin } from '@remix-run/reconciler'
import type { TuiElementNode } from '../tui-node-policy.ts'

export let stylePlugin: Plugin<TuiElementNode> = definePlugin({
  phase: 'special',
  priority: 0,
  keys: ['style'],
  shouldActivate(context) {
    return (
      typeof context.delta.nextProps.style === 'object' && context.delta.nextProps.style != null
    )
  },
  mount() {
    return {
      previousStyle: null as null | Record<string, unknown>,
    }
  },
  apply(context, slot) {
    let state = slot as { previousStyle: null | Record<string, unknown> }
    let nextStyle = context.delta.nextProps.style as Record<string, unknown>
    if (!nextStyle || typeof nextStyle !== 'object') return
    let previous = state.previousStyle
    if (previous === nextStyle) {
      context.consume('style')
      return
    }

    for (let key in nextStyle) {
      let value = nextStyle[key]
      if (previous && previous[key] === value) continue
      context.host.node.bridge.setProp(context.host.node.host, `style.${key}`, value)
    }

    if (previous) {
      for (let key in previous) {
        if (key in nextStyle) continue
        context.host.node.bridge.removeProp(context.host.node.host, `style.${key}`)
      }
    }

    state.previousStyle = nextStyle
    context.consume('style')
  },
  unmount(context, slot) {
    let state = slot as { previousStyle: null | Record<string, unknown> }
    let previous = state.previousStyle
    if (!previous) return
    for (let key in previous) {
      context.host.node.bridge.removeProp(context.host.node.host, `style.${key}`)
    }
    state.previousStyle = null
  },
})
