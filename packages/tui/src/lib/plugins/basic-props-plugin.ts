import { definePlugin } from '@remix-run/reconciler'
import type { Plugin } from '@remix-run/reconciler'
import type { TuiElementNode } from '../tui-node-policy.ts'

export let basicPropsPlugin: Plugin<TuiElementNode> = definePlugin({
  phase: 'terminal',
  priority: 0,
  mount() {
    return {
      previousProps: {} as Record<string, unknown>,
    }
  },
  apply(context, slot) {
    let state = slot as { previousProps: Record<string, unknown> }
    let nextProps = context.remainingPropsView()

    for (let key in nextProps) {
      let value = nextProps[key]
      if (state.previousProps[key] === value) continue
      context.host.node.bridge.setProp(context.host.node.host, key, value)
    }

    for (let key in state.previousProps) {
      if (key in nextProps) continue
      context.host.node.bridge.removeProp(context.host.node.host, key)
    }

    state.previousProps = nextProps
  },
  unmount(context, slot) {
    let state = slot as { previousProps: Record<string, unknown> }
    for (let key in state.previousProps) {
      context.host.node.bridge.removeProp(context.host.node.host, key)
    }
    state.previousProps = {}
  },
})
