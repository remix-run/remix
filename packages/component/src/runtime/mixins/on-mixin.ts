import type { MixinDescriptor, MixinType } from './mixin.ts'
import { DIRECT_EVENT, type ElementProps } from '../core/vnode.ts'
import type { EnsureEvent, EventMap } from '../event-types.ts'

type SignaledListener<event extends Event> = (
  event: event,
  signal: AbortSignal,
) => void | Promise<void>

type EventType<target extends Element> = string & keyof EventMap<target>

type ListenerFor<target extends Element, type extends EventType<target>> = SignaledListener<
  EnsureEvent<EventMap<target>[type], target>
>

export type OnMixinDescriptor = {
  type: typeof onMixinType
  args: [type: string, handler: SignaledListener<Event>, captureBoolean?: boolean]
}

type OnArguments = OnMixinDescriptor['args']

export type DirectEventSync = (
  dom: Element,
  bindings: OnBinding[] | undefined,
  descriptors: OnMixinDescriptor[] | undefined,
  detach: boolean,
) => OnBinding[] | undefined

// EventTarget retains the object identity across renders and calls handleEvent on dispatch.
export class OnBinding {
  type: string
  capture: boolean
  handler: OnArguments[1]
  controller?: AbortController

  constructor(args: OnArguments) {
    this.type = args[0]
    this.handler = args[1]
    this.capture = !!args[2]
  }

  handleEvent(event: Event) {
    this.controller?.abort(new DOMException('', 'EventReentry'))
    this.controller = new AbortController()
    let handler = this.handler
    void handler(event, this.controller.signal)
  }

  attach(node: Element) {
    node.addEventListener(this.type, this, this.capture)
  }

  detach(node?: Element) {
    node?.removeEventListener(this.type, this, this.capture)
  }

  abort() {
    this.controller?.abort(new DOMException('', 'AbortError'))
    this.controller = undefined
  }

  update(node: Element | undefined, args: OnArguments, abortOnRebind = false) {
    this.handler = args[1]
    if (this.type !== args[0] || this.capture !== !!args[2]) {
      this.detach(node)
      if (abortOnRebind) this.abort()
      this.type = args[0]
      this.capture = !!args[2]
      if (node) this.attach(node)
    }
  }
}

function syncDirectEvents(
  dom: Element,
  bindings: OnBinding[] | undefined,
  descriptors: OnMixinDescriptor[] | undefined,
  detach: boolean,
): OnBinding[] | undefined {
  let count = descriptors?.length ?? 0
  if (!count && !bindings) return undefined
  bindings ??= []
  if (descriptors) {
    for (let i = 0; i < count; i++) {
      let args = descriptors[i].args
      let binding = bindings[i]
      if (binding) binding.update(dom, args, true)
      else {
        binding = bindings[i] = new OnBinding(args)
        binding.attach(dom)
      }
    }
  }
  for (let i = count; i < bindings.length; i++) {
    if (detach) bindings[i].detach(dom)
    bindings[i].abort()
  }
  if (count) {
    bindings.length = count
    return bindings
  }
  return undefined
}

const onMixinSetup: MixinType<Element, OnArguments, ElementProps> = (handle) => {
  let node: Element | undefined
  let binding = new OnBinding(['', () => {}])
  handle.addEventListener('insert', (event) => {
    node = event.node
    binding.attach(node)
  })
  handle.addEventListener('remove', () => {
    binding.detach(node)
    binding.abort()
    node = undefined
  })
  return (type, handler, capture = false) => {
    binding.update(node, [type, handler, capture])
    return handle.element
  }
}

// Keep the browser's direct event path tied to the setup identity without pulling in MixinRuntime.
const onMixinType = Object.assign(onMixinSetup, {
  __rmxMixinSsr: false,
  [DIRECT_EVENT]: syncDirectEvents,
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
  target extends Element = Element,
  type extends EventType<target> = EventType<target>,
>(
  type: type,
  handler: ListenerFor<target, type>,
  captureBoolean?: boolean,
): MixinDescriptor<target, [type, ListenerFor<target, type>, boolean?], ElementProps> {
  // Keep this typed wrapper so JSX host context can infer event/currentTarget
  // from `type`, rather than exposing the raw `string` + `Event` runtime signature.
  return {
    type: onMixinType,
    args: [type as string, handler as unknown as SignaledListener<Event>, captureBoolean],
  } as unknown as MixinDescriptor<target, [type, ListenerFor<target, type>, boolean?], ElementProps>
}
