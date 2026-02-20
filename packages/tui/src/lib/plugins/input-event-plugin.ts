import { definePlugin } from '@remix-run/reconciler'
import type { Plugin } from '@remix-run/reconciler'
import type { TuiElementNode } from '../tui-node-policy.ts'

export let inputEventPlugin: Plugin<TuiElementNode> = definePlugin({
  phase: 'special',
  priority: 2,
  routing: { keys: ['on'] },
  shouldActivate(context) {
    return typeof context.delta.nextProps.on === 'object' && context.delta.nextProps.on != null
  },
  mount() {
    return {
      previousOn: null as null | Record<string, unknown>,
    }
  },
  apply(context, slot) {
    let state = slot as { previousOn: null | Record<string, unknown> }
    let nextOn = context.delta.nextProps.on as Record<string, unknown>
    if (!nextOn || typeof nextOn !== 'object') return
    let previous = state.previousOn
    if (previous === nextOn) {
      context.consume('on')
      return
    }
    for (let key in nextOn) {
      let value = nextOn[key]
      if (previous && previous[key] === value) continue
      context.host.node.bridge.setProp(context.host.node.host, `on.${key}`, value)
    }
    if (previous) {
      for (let key in previous) {
        if (key in nextOn) continue
        context.host.node.bridge.removeProp(context.host.node.host, `on.${key}`)
      }
    }
    state.previousOn = nextOn
    context.consume('on')
  },
  unmount(context, slot) {
    let state = slot as { previousOn: null | Record<string, unknown> }
    let previous = state.previousOn
    if (!previous) return
    for (let key in previous) {
      context.host.node.bridge.removeProp(context.host.node.host, `on.${key}`)
    }
    state.previousOn = null
  },
})
