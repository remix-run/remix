import { definePlugin } from '@remix-run/reconciler'
import type { PluginCommitEvent } from '@remix-run/reconciler'
import type { Plugin } from '@remix-run/reconciler'
import type { DomElementNode } from '../dom-node-policy.ts'

type ListenerEntry = {
  dispatch: EventListener
}
type ListenerTable = Map<string, ListenerEntry>

export let onPlugin: Plugin<DomElementNode> = definePlugin({
  phase: 'special',
  priority: 0,
  keys: ['on'],
  shouldActivate(context) {
    return typeof context.delta.nextProps.on === 'object' && context.delta.nextProps.on != null
  },
  setup(handle) {
    let element = handle.host.node as EventTarget
    let activeByType = new Map<string, EventListener>()
    let listenerTable: ListenerTable = new Map()

    handle.addEventListener('remove', () => {
      for (let [type, entry] of listenerTable) {
        element.removeEventListener(type, entry.dispatch)
      }
      listenerTable.clear()
      activeByType.clear()
    })

    handle.addEventListener('commit', (event) => {
      let context = event as PluginCommitEvent<DomElementNode>
      let nextOn = context.delta.nextProps.on
      if (!nextOn || typeof nextOn !== 'object') return
      let nextByType = nextOn as Record<string, unknown>

      for (let [type, entry] of listenerTable) {
        if (type in nextByType) continue
        element.removeEventListener(type, entry.dispatch)
        listenerTable.delete(type)
        activeByType.delete(type)
      }

      for (let type in nextByType) {
        let candidate = nextByType[type]
        if (typeof candidate !== 'function') continue
        let nextHandler = candidate as EventListener
        let existing = listenerTable.get(type)
        if (existing) {
          activeByType.set(type, nextHandler)
          continue
        }
        let dispatch: EventListener = (event) => {
          let active = activeByType.get(type)
          if (!active) return
          active(event)
        }
        listenerTable.set(type, {
          dispatch,
        })
        activeByType.set(type, nextHandler)
        element.addEventListener(type, dispatch)
      }

      context.consume('on')
    })
  },
})
