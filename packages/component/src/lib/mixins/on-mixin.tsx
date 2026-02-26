import { createMixin } from '../mixin.ts'
import type { ElementProps } from '../jsx.ts'
import type { MixinDescriptor } from '../mixin.ts'

export type Dispatched<event extends Event, target extends EventTarget> = Omit<
  event,
  'currentTarget'
> & { currentTarget: target }

type EnsureEvent<event, target extends EventTarget> = event extends Event
  ? Dispatched<event, target>
  : never

type SignaledListener<event extends Event> = (
  event: event,
  signal: AbortSignal,
) => void | Promise<void>

type EventType<target extends EventTarget> = keyof EventMap<target>

type ListenerFor<target extends EventTarget, type extends EventType<target>> = SignaledListener<
  EnsureEvent<EventMap<target>[type], target>
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

  return (type, handler, captureBoolean = false, props) => {
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

    return <handle.element {...props} />
  }
})

export function on<
  target extends EventTarget = Element,
  type extends EventType<target> = EventType<target>,
>(
  type: type,
  handler: ListenerFor<target, type>,
  captureBoolean?: boolean,
): MixinDescriptor<target, [type, ListenerFor<target, type>, boolean?], ElementProps> {
  return onMixin(
    type as string,
    handler as unknown as SignaledListener<Event>,
    captureBoolean,
  ) as unknown as MixinDescriptor<target, [type, ListenerFor<target, type>, boolean?], ElementProps>
}

// prettier-ignore
type EventMap<target extends EventTarget> = (
  target extends HTMLElement ? HTMLElementEventMap :
  target extends SVGSVGElement ? SVGSVGElementEventMap :
  target extends SVGElement ? SVGElementEventMap :
  target extends Element ? ElementEventMap :
  target extends Window ? WindowEventMap :
  target extends Document ? DocumentEventMap :
  target extends MediaQueryList ? MediaQueryListEventMap :
  target extends EventSource ? EventSourceEventMap :
  target extends FileReader ? FileReaderEventMap :
  target extends AbortSignal ? AbortSignalEventMap :
  target extends Animation ? AnimationEventMap :
  target extends EventTarget ? GlobalEventHandlersEventMap :
  never
)
