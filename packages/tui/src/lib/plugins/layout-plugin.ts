import { definePlugin } from '@remix-run/reconciler'
import type { Plugin } from '@remix-run/reconciler'
import type { TuiElementNode } from '../tui-node-policy.ts'

export let layoutPlugin: Plugin<TuiElementNode> = definePlugin({
  phase: 'special',
  priority: 1,
  keys: ['layout'],
  shouldActivate(context) {
    return (
      typeof context.delta.nextProps.layout === 'object' && context.delta.nextProps.layout != null
    )
  },
  mount() {
    return {
      previousLayout: null as null | Record<string, unknown>,
    }
  },
  apply(context, slot) {
    let state = slot as { previousLayout: null | Record<string, unknown> }
    let nextLayout = context.delta.nextProps.layout as Record<string, unknown>
    if (!nextLayout || typeof nextLayout !== 'object') return
    let previous = state.previousLayout
    if (previous === nextLayout) {
      context.consume('layout')
      return
    }
    for (let key in nextLayout) {
      let value = nextLayout[key]
      if (previous && previous[key] === value) continue
      context.host.node.bridge.setProp(context.host.node.host, `layout.${key}`, value)
    }
    if (previous) {
      for (let key in previous) {
        if (key in nextLayout) continue
        context.host.node.bridge.removeProp(context.host.node.host, `layout.${key}`)
      }
    }
    state.previousLayout = nextLayout
    context.consume('layout')
  },
  unmount(context, slot) {
    let state = slot as { previousLayout: null | Record<string, unknown> }
    let previous = state.previousLayout
    if (!previous) return
    for (let key in previous) {
      context.host.node.bridge.removeProp(context.host.node.host, `layout.${key}`)
    }
    state.previousLayout = null
  },
})
