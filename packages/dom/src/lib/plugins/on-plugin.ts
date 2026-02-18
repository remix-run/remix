import { definePlugin } from '@remix-run/reconciler'
import type { Plugin } from '@remix-run/reconciler'
import type { DomElementNode, DomNode, DomParentNode, DomTextNode } from '../dom-node-policy.ts'

type ListenerEntry = {
  dispatch: EventListener
}
type ListenerTable = Map<string, ListenerEntry>

export let onPlugin: Plugin<DomParentNode, DomNode, DomTextNode, DomElementNode> = definePlugin({
  phase: 'special',
  priority: 0,
  routing: { keys: ['on'] },
  shouldActivate(context) {
    return typeof context.delta.nextProps.on === 'object' && context.delta.nextProps.on != null
  },
  mount() {
    return {
      activeByType: new Map<string, EventListener>(),
      listenerTable: new Map<string, ListenerEntry>(),
    }
  },
  apply(context, slot) {
    let element = context.host.node as EventTarget
    let state = slot as {
      activeByType: Map<string, EventListener>
      listenerTable: ListenerTable
    }
    let nextOn = context.delta.nextProps.on
    if (!nextOn || typeof nextOn !== 'object') return
    let nextByType = nextOn as Record<string, unknown>

    for (let [type, entry] of state.listenerTable) {
      if (type in nextByType) continue
      element.removeEventListener(type, entry.dispatch)
      state.listenerTable.delete(type)
      state.activeByType.delete(type)
    }

    for (let type in nextByType) {
      let candidate = nextByType[type]
      if (typeof candidate !== 'function') continue
      let nextHandler = candidate as EventListener
      let existing = state.listenerTable.get(type)
      if (existing) {
        state.activeByType.set(type, nextHandler)
        continue
      }
      let dispatch: EventListener = (event) => {
        let active = state.activeByType.get(type)
        if (!active) return
        active(event)
      }
      state.listenerTable.set(type, {
        dispatch,
      })
      state.activeByType.set(type, nextHandler)
      element.addEventListener(type, dispatch)
    }

    context.consume('on')
  },
  unmount(context, slot) {
    let element = context.host.node as EventTarget
    let state = slot as {
      activeByType: Map<string, EventListener>
      listenerTable: ListenerTable
    }
    for (let [type, entry] of state.listenerTable) {
      element.removeEventListener(type, entry.dispatch)
    }
    state.listenerTable.clear()
    state.activeByType.clear()
  },
})
