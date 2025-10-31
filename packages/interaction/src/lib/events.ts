// prettier-ignore
/**
 * A dispatched event with the current target set to the target that dispatched the event.
 */
export type Dispatched<event extends Event, target extends EventTarget> =
  Omit<event, 'currentTarget' > & { currentTarget: target }

/**
 * A container for event listeners that can be updated in place and disposed
 * together.
 */
export type EventsContainer<target extends EventTarget> = {
  dispose: () => void
  set: (listeners: EventListeners<target>) => void
}

/**
 * A map of event types to listeners or arrays of listeners (or descriptors).
 *
 * @example
 * ```ts
 * let listeners: EventListeners<HTMLElement> = {
 *   click: (event) => {
 *     console.log('clicked')
 *   },
 *   keydown: [
 *     (event) => {},
 *     capture((event) => {}),
 *   ],
 * }
 * ```
 */
export type EventListeners<target extends EventTarget = EventTarget> = Partial<{
  [k in EventType<target>]:
    | ListenerOrDescriptor<ListenerFor<target, k>>
    | Array<ListenerOrDescriptor<ListenerFor<target, k>>>
}>

/**
 * A function that sets up an interaction on a target.
 */
export type InteractionSetup = (target: EventTarget, signal: AbortSignal) => void

// interactions ------------------------------------------------------------------------------------

/**
 * ### Description
 *
 * Defines an interaction type with its setup function.
 *
 * ### Example
 *
 * ```ts
 * import { defineInteraction, on } from '@remix-run/interaction'
 *
 * // define the interaction
 * export let keydownEnter = defineInteraction('my:keydown-enter', KeydownEnter)
 *
 * // Provide type safety for consumers
 * declare global {
 *   interface HTMLElementEventMap {
 *     [keydownEnter]: KeyboardEvent
 *   }
 * }
 *
 * // setup the interaction
 * function KeydownEnter(target, signal) {
 *   on(target, signal, {
 *     keydown: (event) => {
 *       if (event.key === 'Enter') {
 *         target.dispatchEvent(new KeyboardEvent(keydownEnter, { key: 'Enter' }))
 *       }
 *     },
 *   })
 * }
 *
 * // then consumers use the string to bind the interaction
 * on(button, {
 *   [keydownEnter]: (event) => {
 *     console.log('Enter key pressed')
 *   },
 * })
 * ```
 */
export function defineInteraction<type extends string>(type: type, interaction: InteractionSetup) {
  interactions.set(type, interaction)
  return type
}

// container ---------------------------------------------------------------------------------------

/**
 * ### Description
 *
 * Creates an event container on a target with reentry protection and efficient
 * listener updates (primarily for vdom integrations). If you don't need to
 * update listeners in place, you can use `on` instead.
 *
 * ### Example
 *
 * ```ts
 * let button = document.createElement('button')
 * let container = createContainer(button)
 * container.set({
 *   click: (event, signal) => {
 *     console.log('clicked')
 *   },
 * })
 * ```
 */
export function createContainer<target extends EventTarget>(
  /**
   * The event target to wrap, usually a DOM element, window, or document, but
   * any EventTarget is supported.
   */
  target: target,

  /**
   * An optional abort signal to dispose the container when the signal is aborted
   *
   * @example
   * ```ts
   * let controller = new AbortController()
   * let container = createContainer(target, controller.signal)
   * // will remove all listeners and dispose the container
   * controller.abort()
   * ```
   */
  signal?: AbortSignal,
): EventsContainer<target> {
  let controller = new AbortController()

  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  let bindings: Partial<{ [K in EventType<target>]: Binding<ListenerFor<target, K>>[] }> = {}

  return {
    dispose: () => controller.abort(),
    set: (listeners) => {
      // TODO: figure out if we can remove this cast
      for (let type of Object.keys(listeners) as Array<EventType<target>>) {
        let raw = listeners[type]
        if (raw == null) continue

        // this function was a bit vibe coded, can probably be simplified w/o
        // all the weird type gymnastics and funny inline function definition
        function updateTypeBindings<k extends EventType<target>>(
          type: k,
          raw:
            | ListenerOrDescriptor<ListenerFor<target, k>>
            | Array<ListenerOrDescriptor<ListenerFor<target, k>>>,
        ) {
          let descriptors = normalizeDescriptors<ListenerFor<target, k>>(raw)

          let existing = bindings[type]
          if (!existing) {
            bindings[type] = descriptors.map((d) =>
              createBinding(target, type, d.listener, d.options, controller.signal),
            )
            return
          }

          // Update existing bindings in place by index
          let min = Math.min(existing.length, descriptors.length)
          for (let i = 0; i < min; i++) {
            let d = descriptors[i]
            let b = existing[i]
            if (optionsChanged(d.options, b.options)) {
              b.rebind(d.listener, d.options)
            } else {
              b.setListener(d.listener)
            }
          }

          // Add new bindings for any extra descriptors
          if (descriptors.length > existing.length) {
            for (let i = existing.length; i < descriptors.length; i++) {
              let d = descriptors[i]
              existing.push(createBinding(target, type, d.listener, d.options, controller.signal))
            }
          }

          // Dispose any extra existing bindings not present anymore
          if (existing.length > descriptors.length) {
            for (let i = descriptors.length; i < existing.length; i++) {
              existing[i].dispose()
            }
            existing.length = descriptors.length
          }
        }

        updateTypeBindings(type, raw)
      }
    },
  }
}

// on ----------------------------------------------------------------------------------------------

/**
 * ### Description
 *
 * Add event listeners with async reentry protection and semantic Interactions.
 *
 * ### Basic usage:
 *
 * ```ts
 * import { on } from "@remix-run/interaction"
 * import { longPress } from "@remix-run/interaction/press"
 *
 * let button = document.createElement('button')
 * on(button, {
 *   click: (event, signal) => {
 *     console.log('clicked')
 *   },
 *   [longPress]: (event) => {
 *     console.log('long pressed')
 *   },
 * })
 * ```
 *
 * ### With abort signal to dispose the container:
 *
 * ```ts
 * let controller = new AbortController()
 * on(button, controller.signal, {
 *   click: (event, signal) => {
 *     console.log('clicked')
 *   },
 * })
 * // will remove all listeners and dispose the container
 * controller.abort()
 * ```
 *
 * ### With array of listeners on a type:
 *
 * ```ts
 * on(button, {
 *   click: [
 *     (event, signal) => {
 *       if (someCondition) {
 *         event.stopImmediatePropagation()
 *       }
 *       console.log('called')
 *     },
 *     (event, signal) => {
 *       console.log('not called')
 *     },
 *   ],
 * })
 * ```
 */
export function on<target extends EventTarget>(
  target: target,
  signal: AbortSignal,
  listeners: EventListeners<target>,
): () => void
export function on<target extends EventTarget>(
  target: target,
  listeners: EventListeners<target>,
): () => void
export function on(
  target: EventTarget,
  signalOrListeners: AbortSignal | EventListeners,
  listeners?: EventListeners,
): () => void {
  if (!(signalOrListeners instanceof AbortSignal)) {
    let container = createContainer(target)
    container.set(signalOrListeners)
    return container.dispose
  } else if (listeners) {
    let container = createContainer(target, signalOrListeners)
    container.set(listeners)
    return container.dispose
  }
  throw new Error('Invalid arguments')
}

// descriptors -------------------------------------------------------------------------------------

export function listenWith<L>(options: AddEventListenerOptions, listener: L): Descriptor<L> {
  return { options, listener }
}

export function capture<L>(listener: L): Descriptor<L> {
  return listenWith({ capture: true }, listener)
}

// TypedEventTarget --------------------------------------------------------------------------------

export class TypedEventTarget<eventMap> extends EventTarget {
  declare readonly __eventMap?: eventMap
}

export interface TypedEventTarget<eventMap> {
  addEventListener<type extends Extract<keyof eventMap, string>>(
    type: type,
    listener: TypedEventListener<eventMap>[type],
    options?: AddEventListenerOptions,
  ): void
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void
  removeEventListener<type extends Extract<keyof eventMap, string>>(
    type: type,
    listener: TypedEventListener<eventMap>[type],
    options?: EventListenerOptions,
  ): void
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions,
  ): void
}
type TypedEventListener<eventMap> = {
  [key in keyof eventMap]: (event: eventMap[key]) => void
}

// internal ----------------------------------------------------------------------------------------
let interactions = new Map<string, InteractionSetup>()
let initializedTargets = new WeakMap<EventTarget, Set<Function>>()

type ListenerOrDescriptor<Listener> = Listener | Descriptor<Listener>

interface Descriptor<L> {
  options: AddEventListenerOptions
  listener: L
}

function normalizeDescriptors<Listener>(
  raw: ListenerOrDescriptor<Listener> | ListenerOrDescriptor<Listener>[],
): Descriptor<Listener>[] {
  if (Array.isArray(raw)) {
    return raw.map((item) =>
      isDescriptor<Listener>(item) ? item : { listener: item, options: {} },
    )
  }
  return [isDescriptor<Listener>(raw) ? raw : { listener: raw, options: {} }]
}

function isDescriptor<L>(value: any): value is Descriptor<L> {
  return typeof value === 'object' && value !== null && 'options' in value && 'listener' in value
}

type Binding<L> = {
  options: AddEventListenerOptions
  type: string
  setListener: (listener: L) => void
  rebind: (listener: L, options: AddEventListenerOptions) => void
  dispose: () => void
}

type SignaledListener<event extends Event> = (
  event: event,
  signal: AbortSignal,
) => void | Promise<void>

/**
 * Encapsulates a binding between an event type and a listener.
 *
 * - Adds reentry signal for async listeners
 * - Efficiently updates listeners in place with simple diff (useful for
 *   vdom integrations)
 */
function createBinding<target extends EventTarget, k extends EventType<target>>(
  target: target,
  type: k,
  listener: ListenerFor<target, k>,
  options: AddEventListenerOptions,
  containerSignal: AbortSignal,
): Binding<ListenerFor<target, k>> {
  let reentry = new AbortController()

  function abort() {
    reentry.abort(new DOMException('', 'EventReentry'))
    reentry = new AbortController()
  }

  let wrappedListener = (event: Event) => {
    abort()
    // TODO: figure out if we can remove this cast
    listener(event as any, reentry.signal)
  }

  function bind() {
    target.addEventListener(type, wrappedListener, options)
  }

  function unbind() {
    abort()
    target.removeEventListener(type, wrappedListener, options)
  }

  if (containerSignal) {
    containerSignal.addEventListener('abort', unbind, { once: true })
  }

  if (interactions.has(type)) {
    let interaction = interactions.get(type)!
    let initialized = initializedTargets.get(target)
    if (!initialized) {
      initialized = new Set()
      initializedTargets.set(target, initialized)
    }
    if (!initialized.has(interaction)) {
      interaction(target, containerSignal)
      initialized.add(interaction)
    }
  }

  bind()

  return {
    type,
    get options() {
      return options
    },
    setListener(newListener) {
      listener = newListener
    },
    rebind(newListener, newOptions) {
      unbind()
      options = newOptions
      listener = newListener
      bind()
    },
    dispose() {
      unbind()
      if (containerSignal) {
        containerSignal.removeEventListener('abort', unbind)
      }
    },
  }
}

function optionsChanged(a: AddEventListenerOptions, b: AddEventListenerOptions): boolean {
  return (
    a.capture !== b.capture || a.once !== b.once || a.passive !== b.passive || a.signal !== b.signal
  )
}

type EnsureEvent<event, target extends EventTarget> = event extends Event
  ? Dispatched<event, target>
  : never

type EventType<target extends EventTarget> = target extends { __eventMap?: infer eventMap }
  ? keyof eventMap // TypedEventTarget
  : keyof EventMap<target>

// prettier-ignore
type ListenerFor<target extends EventTarget, k extends EventType<target>> =
  SignaledListener<EnsureEvent<EventMap<target>[k], target>>

// prettier-ignore
type EventMap<target extends EventTarget> = (
  // TypedEventTarget
  target extends { __eventMap?: infer eventMap } ? eventMap :

  // elements
  target extends HTMLElement ? HTMLElementEventMap :
  target extends Element ? ElementEventMap :
  target extends Window ? WindowEventMap :
  target extends Document ? DocumentEventMap :

  // everything else
  target extends AbortSignal ? AbortSignalEventMap :
  target extends Animation ? AnimationEventMap :
  target extends AudioDecoder ? AudioDecoderEventMap :
  target extends AudioEncoder ? AudioEncoderEventMap :
  target extends AudioNode ? GlobalEventHandlersEventMap :
  target extends BaseAudioContext ? BaseAudioContextEventMap :
  target extends BroadcastChannel ? BroadcastChannelEventMap :
  target extends Clipboard ? GlobalEventHandlersEventMap :
  target extends EventSource ? EventSourceEventMap :
  target extends FileReader ? FileReaderEventMap :
  target extends FontFaceSet ? FontFaceSetEventMap :
  target extends IDBDatabase ? IDBDatabaseEventMap :
  target extends IDBTransaction ? IDBTransactionEventMap :
  target extends MIDIAccess ? MIDIAccessEventMap :
  target extends MIDIPort ? MIDIPortEventMap :
  target extends MediaDevices ? MediaDevicesEventMap :
  target extends MediaKeySession ? MediaKeySessionEventMap :
  target extends MediaQueryList ? MediaQueryListEventMap :
  target extends MediaRecorder ? MediaRecorderEventMap :
  target extends MediaSource ? MediaSourceEventMap :
  target extends MediaStream ? MediaStreamEventMap :
  target extends MediaStreamTrack ? MediaStreamTrackEventMap :
  target extends MessagePort ? MessagePortEventMap :
  target extends Node ? GlobalEventHandlersEventMap :
  target extends Notification ? NotificationEventMap :
  target extends OffscreenCanvas ? OffscreenCanvasEventMap :
  target extends PaymentRequest ? PaymentRequestEventMap :
  target extends PaymentResponse ? PaymentResponseEventMap :
  target extends Performance ? PerformanceEventMap :
  target extends PermissionStatus ? PermissionStatusEventMap :
  target extends PictureInPictureWindow ? PictureInPictureWindowEventMap :
  target extends RTCDTMFSender ? RTCDTMFSenderEventMap :
  target extends RTCDataChannel ? RTCDataChannelEventMap :
  target extends RTCDtlsTransport ? RTCDtlsTransportEventMap :
  target extends RTCIceTransport ? RTCIceTransportEventMap :
  target extends RTCPeerConnection ? RTCPeerConnectionEventMap :
  target extends RTCSctpTransport ? RTCSctpTransportEventMap :
  target extends RemotePlayback ? RemotePlaybackEventMap :
  target extends ScreenOrientation ? ScreenOrientationEventMap :
  target extends ServiceWorkerContainer ? ServiceWorkerContainerEventMap :
  target extends ServiceWorkerRegistration ? ServiceWorkerRegistrationEventMap :
  target extends ServiceWorker ? AbstractWorkerEventMap :
  target extends SharedWorker ? AbstractWorkerEventMap :
  target extends SourceBuffer ? SourceBufferEventMap :
  target extends SourceBufferList ? SourceBufferListEventMap :
  target extends SpeechSynthesis ? SpeechSynthesisEventMap :
  target extends SpeechSynthesisUtterance ? SpeechSynthesisUtteranceEventMap :
  target extends TextTrack ? TextTrackEventMap :
  target extends TextTrackCue ? TextTrackCueEventMap :
  target extends TextTrackList ? TextTrackListEventMap :
  target extends VideoDecoder ? VideoDecoderEventMap :
  target extends VideoEncoder ? VideoEncoderEventMap :
  target extends VisualViewport ? VisualViewportEventMap :
  target extends WakeLockSentinel ? WakeLockSentinelEventMap :
  target extends WebSocket ? WebSocketEventMap :
  target extends Window ? (WindowEventMap & GlobalEventHandlersEventMap) :
  target extends Worker ? AbstractWorkerEventMap :
  target extends XMLHttpRequestEventTarget ? XMLHttpRequestEventTargetEventMap :
  // default
  GlobalEventHandlersEventMap & Record<string, Event>
);
