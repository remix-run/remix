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

let onMixin = createMixin<
  Element,
  [type: string, handler: SignaledListener<Event>, captureBoolean?: boolean],
  ElementProps
>((handle) => {
  let currentHandler: SignaledListener<Event> = () => {}
  let currentType = ''
  let currentCapture = false
  let reentry: AbortController | null = null

  let stableHandler = (event: Event) => {
    reentry?.abort(new DOMException('', 'EventReentry'))
    reentry = new AbortController()
    void currentHandler(event, reentry.signal)
  }

  handle.addEventListener('insert', (event) => {
    let node = event.node
    node.addEventListener(currentType, stableHandler, currentCapture)
    handle.addEventListener('remove', () => {
      node.removeEventListener(currentType, stableHandler, currentCapture)
      reentry?.abort(new DOMException('', 'AbortError'))
    })
  })

  return (type, handler, captureBoolean = false) => {
    let previousType = currentType
    let previousCapture = currentCapture
    let needsRebind = currentType !== type || currentCapture !== captureBoolean
    currentType = type
    currentHandler = handler
    currentCapture = captureBoolean

    if (needsRebind) {
      handle.queueTask((node) => {
        node.removeEventListener(previousType, stableHandler, previousCapture)
        node.addEventListener(type, stableHandler, captureBoolean)
      })
    }

    return handle.element
  }
})

export function on<
  target extends Element = Element,
  type extends EventType<target> = EventType<target>,
>(
  type: type,
  handler: ListenerFor<target, type>,
  captureBoolean?: boolean,
): MixinDescriptor<target, [type, ListenerFor<target, type>, boolean?], ElementProps> {
  // Keep this typed wrapper so JSX host context can infer event/currentTarget
  // from `type`, rather than exposing the raw `string` + `Event` runtime signature.
  return onMixin(
    type as string,
    handler as unknown as SignaledListener<Event>,
    captureBoolean,
  ) as unknown as MixinDescriptor<target, [type, ListenerFor<target, type>, boolean?], ElementProps>
}
