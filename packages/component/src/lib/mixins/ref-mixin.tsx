import { createMixin } from '../mixin.ts'
import type { ElementProps } from '../jsx.ts'

export type RefCallback<node extends EventTarget> = (node: node, signal: AbortSignal) => void

export let ref = createMixin<Element, [callback: RefCallback<Element>], ElementProps>((handle) => {
  handle.addEventListener('insert', (event) => {
    callback(event.node, handle.signal)
  })

  let callback: RefCallback<Element> = () => {}
  return (nextCallback, props) => {
    callback = nextCallback
    return <handle.element {...props} />
  }
})
