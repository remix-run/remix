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

type OnMixinProps = ElementProps & {
  connect?: (node: Element, signal: AbortSignal) => void
}

let onMixin = createMixin<
  Element,
  [type: string, handler: SignaledListener<Event>, captureBoolean?: boolean],
  OnMixinProps
>((handle) => {
  let currentHandler: SignaledListener<Event> = () => {}
  let currentType = ''
  let currentCapture = false
  let currentNode: Element | null = null
  let reentry: AbortController | null = null
  let teardownNode: (() => void) | null = null

  let stableHandler = (event: Event) => {
    if (reentry) {
      reentry.abort(new DOMException('', 'EventReentry'))
    }
    reentry = new AbortController()
    void currentHandler(event, reentry.signal)
  }

  return (type, handler, captureBoolean = false, props) => {
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

    return (
      <handle.element
        {...props}
        connect={(nextNode, signal) => {
          if (currentNode !== nextNode) {
            teardownNode?.()
            currentNode = nextNode
            currentNode.addEventListener(type, stableHandler, captureBoolean)
            teardownNode = () => {
              if (reentry) {
                reentry.abort(new DOMException('', 'AbortError'))
                reentry = null
              }
              nextNode.removeEventListener(type, stableHandler, captureBoolean)
            }
          }

          signal.addEventListener(
            'abort',
            () => {
              teardownNode?.()
              teardownNode = null
              if (currentNode === nextNode) {
                currentNode = null
              }
            },
            { once: true },
          )
        }}
      />
    )
  }
})

export function on<target extends EventTarget = Element, type extends EventType<target> = EventType<target>>(
  type: type,
  handler: ListenerFor<target, type>,
  captureBoolean?: boolean,
): MixinDescriptor<target, [type, ListenerFor<target, type>, boolean?], ElementProps> {
  return onMixin(type as string, handler as unknown as SignaledListener<Event>, captureBoolean) as unknown as MixinDescriptor<
    target,
    [type, ListenerFor<target, type>, boolean?],
    ElementProps
  >
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
