import { definePlugin } from '../types.ts'

export const connect = definePlugin(() => (host) => {
  let connect: unknown

  host.addEventListener('insert', (event) => {
    if (!isConnect(connect)) return
    if (connect.length >= 2) {
      let controller = new AbortController()
      connect(event.node, controller.signal)
      host.addEventListener('remove', () => controller.abort())
    } else {
      connect(event.node)
    }
  })

  return (input) => {
    connect = input.props.connect
    delete input.props.connect
    return input
  }
})

export type ConnectFn = (node: Element, signal?: AbortSignal) => void

function isConnect(value: unknown): value is ConnectFn {
  return typeof value === 'function'
}
