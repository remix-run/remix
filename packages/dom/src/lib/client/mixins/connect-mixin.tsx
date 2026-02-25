import { createMixin } from '@remix-run/reconciler'
import type { DomElementType } from '../../shared/jsx/jsx-runtime.ts'

type ConnectCallback<target extends EventTarget> = (node: target, signal?: AbortSignal) => void

export let connect = createMixin<
  [callback: ConnectCallback<EventTarget>],
  EventTarget,
  DomElementType
>((handle) => {
  let capturedCallback: ConnectCallback<EventTarget>

  handle.queueTask((node) => {
    if (capturedCallback.length === 1) {
      capturedCallback(node)
    } else {
      let controller = new AbortController()
      capturedCallback(node, controller.signal)
      handle.addEventListener('remove', () => {
        controller.abort('connection removed')
      })
    }
  })

  return (callback) => {
    if (!capturedCallback) {
      capturedCallback = callback
    }
    return handle.element
  }
})
