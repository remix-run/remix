import { definePlugin } from '@remix-run/reconciler'

export type ConnectValue<node extends EventTarget> = (node: node, signal: AbortSignal) => void

export const connectPlugin = definePlugin<Element>(() => ({
  keys: ['connect'],
  setup() {
    let activeConnect: null | ConnectValue<Element> = null
    let connected = false
    let controller: null | AbortController = null

    return {
      commit(input, node) {
        let value = input.props.connect
        activeConnect = typeof value === 'function' ? (value as ConnectValue<Element>) : null
        delete input.props.connect

        if (!activeConnect) {
          controller?.abort()
          controller = null
          connected = false
          return
        }
        if (connected) return
        let connect = activeConnect

        if (!connect) return
        controller?.abort()
        controller = new AbortController()
        connected = true
        connect(node, controller.signal)
      },
      remove() {
        controller?.abort()
        controller = null
        activeConnect = null
        connected = false
      },
    }
  },
}))
