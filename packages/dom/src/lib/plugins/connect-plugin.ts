import { definePlugin } from '@remix-run/reconciler'

export type ConnectValue<node extends EventTarget> = (node: node, signal: AbortSignal) => void

export const connectPlugin = definePlugin<Element>(() => (host) => {
  let connect: null | ConnectValue<Element> = null

  host.addEventListener('insert', (event) => {
    if (!connect) return
    if (!isInsertEvent(event)) return
    let controller = new AbortController()
    connect(event.node, controller.signal)
    host.addEventListener('remove', () => controller.abort(), { once: true })
  })

  return (input) => {
    let value = input.props.connect
    connect = typeof value === 'function' ? (value as ConnectValue<Element>) : null
    delete input.props.connect
    return input
  }
})

function isInsertEvent(event: Event): event is Event & { node: Element } {
  return 'node' in event && event.node instanceof Element
}
