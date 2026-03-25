import { createMixin } from '../mixin.ts'
import type { ElementProps } from '../jsx.ts'
import type { MixinDescriptor } from '../mixin.ts'
import type {
  EventType as AddEventType,
  ListenerFor as AddEventListenerFor,
} from '../event-listeners.ts'

export type { Dispatched } from '../event-listeners.ts'

type SignaledListener<event extends Event> = (
  event: event,
  signal: AbortSignal,
) => void | Promise<void>

type EventType<target extends Element> = Extract<AddEventType<target>, string>
type ListenerFor<target extends Element, type extends EventType<target>> = SignaledListener<
  Parameters<AddEventListenerFor<target, type>>[0]
>
type OnTuple<target extends Element, type extends EventType<target>> = [
  type: type,
  handler: ListenerFor<target, type>,
  captureBoolean?: boolean,
]
type OnArgs<target extends Element> = {
  [type in EventType<target>]: OnTuple<target, type>
}[EventType<target>]

let onMixin = createMixin<
  Element,
  [type: string, handler: SignaledListener<Event>, captureBoolean?: boolean],
  ElementProps
>((handle) => {
  let currentHandler: SignaledListener<Event> = () => {}
  let currentType = ''
  let currentCapture = false
  let currentNode: Element | null = null
  let reentry: AbortController | null = null

  let stableHandler = (event: Event) => {
    reentry?.abort(new DOMException('', 'EventReentry'))
    reentry = new AbortController()
    void currentHandler(event, reentry.signal)
  }

  handle.addEventListener('insert', (event) => {
    currentNode = event.node
    currentNode.addEventListener(currentType, stableHandler, currentCapture)
  })

  handle.addEventListener('remove', () => {
    currentNode?.removeEventListener(currentType, stableHandler, currentCapture)
    currentNode = null
    reentry?.abort(new DOMException('', 'AbortError'))
  })

  return (type, handler, captureBoolean = false) => {
    let previousType = currentType
    let previousCapture = currentCapture
    let needsRebind = currentType !== type || currentCapture !== captureBoolean
    currentType = type
    currentHandler = handler
    currentCapture = captureBoolean

    if (needsRebind && currentNode) {
      currentNode.removeEventListener(previousType, stableHandler, previousCapture)
      currentNode.addEventListener(type, stableHandler, captureBoolean)
    }

    return handle.element
  }
})

/**
 * Attaches a typed DOM event handler through the mixin system.
 *
 * @param type Event type to listen for.
 * @param handler Event handler.
 * @param captureBoolean Whether to listen during capture.
 * @returns A mixin descriptor for the target element.
 */
export function on<
  target extends Element,
  type extends EventType<target>,
>(...args: OnTuple<target, type>): MixinDescriptor<target, OnTuple<target, type>, ElementProps>
export function on<target extends Element>(...args: OnArgs<target>): MixinDescriptor<
  target,
  OnArgs<target>,
  ElementProps
>
export function on(
  ...args: [type: string, handler: SignaledListener<any>, captureBoolean?: boolean]
): any {
  let [type, handler, captureBoolean] = args

  // Keep this typed wrapper so JSX host context can infer event/currentTarget
  // from `type`, rather than exposing the raw `string` + `Event` runtime signature.
  return onMixin(
    type,
    handler as SignaledListener<Event>,
    captureBoolean,
  )
}
