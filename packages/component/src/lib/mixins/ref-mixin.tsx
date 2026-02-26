import { createMixin } from '../mixin.ts'
import type { ElementProps } from '../jsx.ts'

export type RefCallback<node extends EventTarget> = (node: node, signal: AbortSignal) => void

export let ref = createMixin<Element, [callback: RefCallback<Element>], ElementProps>((handle) => {
  let controller: AbortController | undefined

  handle.addEventListener('insert', (event) => {
    controller = new AbortController()
    callback(event.node, controller.signal)
  })

  handle.addEventListener('remove', () => {
    controller?.abort(new DOMException('', 'AbortError'))
    controller = undefined
  })

  let callback: RefCallback<Element> = () => {}
  return (nextCallback) => {
    callback = nextCallback
    return handle.element
  }
})
