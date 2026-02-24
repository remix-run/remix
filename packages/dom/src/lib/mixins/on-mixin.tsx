import { createMixin } from '@remix-run/reconciler'
import type { MixinDescriptor } from '@remix-run/reconciler'
import type { JSX } from '../jsx/runtime.ts'
import type { DispatchedEvent } from '../jsx/runtime.ts'

type EventMap<target extends EventTarget> = target extends HTMLElement
  ? HTMLElementEventMap
  : target extends SVGSVGElement
    ? SVGSVGElementEventMap
    : target extends SVGElement
      ? SVGElementEventMap
      : target extends Element
        ? ElementEventMap
        : target extends Window
          ? WindowEventMap
          : target extends Document
            ? DocumentEventMap
            : GlobalEventHandlersEventMap & Record<string, Event>

type EventType<target extends EventTarget> = Extract<keyof EventMap<target>, string>
type EventFor<
  target extends EventTarget,
  type extends EventType<target>,
> = EventMap<target>[type] extends Event ? EventMap<target>[type] : Event

type OnHandler<target extends EventTarget, event extends Event> = (
  event: DispatchedEvent<event, target>,
  reentrySignal: AbortSignal,
) => void

type DomElementType = Extract<keyof JSX.IntrinsicElements, string>

let onMixin = createMixin<
  [type: string, handler: OnHandler<EventTarget, Event>],
  EventTarget,
  DomElementType
>((handle) => {
  let activeNode: null | EventTarget = null
  let activeType = ''
  let activeHandler: null | OnHandler<EventTarget, Event> = null
  let reentryController: null | AbortController = null

  let listener: EventListener = (event) => {
    if (!activeHandler) return
    reentryController?.abort()
    reentryController = new AbortController()
    activeHandler(event as DispatchedEvent<Event, EventTarget>, reentryController.signal)
  }

  let detach = () => {
    if (activeNode && activeType) {
      activeNode.removeEventListener(activeType, listener)
    }
  }

  let syncListener = () => {
    if (!activeNode || !activeType) return
    activeNode.addEventListener(activeType, listener)
  }

  handle.addEventListener('remove', () => {
    reentryController?.abort()
    detach()
    activeNode = null
    activeType = ''
    activeHandler = null
  })

  return (type: string, handler: OnHandler<EventTarget, Event>, props) => {
    let changedType = activeType !== type
    let changedHandler = activeHandler !== handler
    if (changedType || changedHandler) {
      detach()
      activeType = type
      activeHandler = handler
      syncListener()
    }
    handle.queueTask((node) => {
      if (activeNode === node) return
      detach()
      activeNode = node
      syncListener()
    })
    return <handle.element {...props} />
  }
})

export function on<target extends EventTarget, type extends EventType<target>>(
  type: type,
  handler: OnHandler<target, EventFor<target, type>>,
): MixinDescriptor<target, [type: type, handler: OnHandler<target, EventFor<target, type>>]>
export function on<target extends EventTarget>(
  type: string,
  handler: OnHandler<target, Event>,
): MixinDescriptor<target, [type: string, handler: OnHandler<target, Event>]>
export function on<target extends EventTarget>(
  type: string,
  handler: OnHandler<target, Event>,
): MixinDescriptor<target, [type: string, handler: OnHandler<target, Event>]> {
  return onMixin(
    type,
    handler as unknown as OnHandler<EventTarget, Event>,
  ) as unknown as MixinDescriptor<target, [type: string, handler: OnHandler<target, Event>]>
}
