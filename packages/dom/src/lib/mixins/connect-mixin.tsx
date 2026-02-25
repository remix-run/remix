import { createMixin } from '@remix-run/reconciler'
import type { MixinDescriptor } from '@remix-run/reconciler'
import type { DomElementType } from '../jsx/jsx-runtime.ts'

type ConnectCallback<target extends EventTarget> = (node: target, signal: AbortSignal) => void

let connectMixin = createMixin<
  [callback: ConnectCallback<EventTarget>],
  EventTarget,
  DomElementType
>((handle) => {
  let activeNode: null | EventTarget = null
  let activeController: null | AbortController = null

  function disconnect() {
    activeController?.abort()
    activeController = null
    activeNode = null
  }

  handle.addEventListener('remove', disconnect)

  return (callback, props) => {
    handle.queueTask((node) => {
      if (activeNode === node) return
      activeController?.abort()
      activeNode = node
      activeController = new AbortController()
      callback(node, activeController.signal)
    })
    return <handle.element {...props} />
  }
})

export function connect<target extends EventTarget>(
  callback: ConnectCallback<target>,
): MixinDescriptor<target, [callback: ConnectCallback<target>]> {
  return connectMixin(
    callback as ConnectCallback<EventTarget>,
  ) as unknown as MixinDescriptor<target, [callback: ConnectCallback<target>]>
}
