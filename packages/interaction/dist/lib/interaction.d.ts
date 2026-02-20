/**
 * A dispatched event with the current target set to the target that dispatched the event.
 */
export type Dispatched<event extends Event, target extends EventTarget> = Omit<event, 'currentTarget'> & {
    currentTarget: target;
};
/**
 * A container for event listeners that can be updated in place and disposed
 * together.
 */
export type EventsContainer<target extends EventTarget> = {
    dispose: () => void;
    set: (listeners: EventListeners<target>) => void;
};
/**
 * A map of event types to listeners or arrays of listeners (or descriptors).
 *
 * @example
 * ```ts
 * let listeners: EventListeners<HTMLElement> = {
 *   click(event) {
 *     console.log('clicked')
 *   },
 *   keydown: [
 *     (event) => {},
 *     { capture: true, listener(event) {} },
 *   ],
 * }
 * ```
 */
export type EventListeners<target extends EventTarget = EventTarget> = Partial<{
    [k in EventType<target>]: ListenerOrDescriptor<ListenerFor<target, k>> | Array<ListenerOrDescriptor<ListenerFor<target, k>>>;
}>;
/**
 * Context object provided to interaction setup functions as a parameter.
 */
export interface Interaction {
    /**
     * The target element this interaction is being set up on.
     */
    readonly target: EventTarget;
    /**
     * The abort signal that will dispose this interaction when aborted.
     */
    readonly signal: AbortSignal;
    /**
     * Create a container on a target with listeners. Automatically passes
     * through signal from the parent container.
     */
    on<target extends EventTarget>(target: target, listeners: EventListeners<target>): void;
}
/**
 * A function that sets up an interaction on a target.
 */
export type InteractionSetup = (handle: Interaction) => void;
/**
 * ### Description
 *
 * Defines an interaction type with its setup function.
 *
 * ### Example
 *
 * ```ts
 * import { defineInteraction, on } from 'remix/interaction'
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
 * function KeydownEnter(handle: Interaction) {
 *   handle.on(handle.target, {
 *     keydown(event) {
 *       if (event.key === 'Enter') {
 *         handle.target.dispatchEvent(new KeyboardEvent(keydownEnter, { key: 'Enter' }))
 *       }
 *     },
 *   })
 * }
 *
 * // then consumers use the string to bind the interaction
 * on(button, {
 *   [keydownEnter](event) {
 *     console.log('Enter key pressed')
 *   },
 * })
 * ```
 *
 * @param type The unique string identifier for this interaction type
 * @param interaction The setup function that configures the interaction
 * @returns The type string, for use as an event name
 */
export declare function defineInteraction<type extends string>(type: type, interaction: InteractionSetup): type;
/**
 * Options for creating an event container.
 */
export type ContainerOptions = {
    /**
     * An optional abort signal to dispose the container when the signal is aborted
     */
    signal?: AbortSignal;
};
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
 *   click(event, signal) {
 *     console.log('clicked')
 *   },
 * })
 * ```
 *
 * Errors thrown in listeners are dispatched as `ErrorEvent` on the target
 * element with `bubbles: true`, allowing them to propagate up the DOM tree.
 *
 * @param target The event target to wrap (DOM element, window, document, or any EventTarget)
 * @param options Optional configuration for the container
 * @returns An `EventsContainer` with `dispose()` and `set()` methods
 */
export declare function createContainer<target extends EventTarget>(target: target, options?: ContainerOptions): EventsContainer<target>;
/**
 * ### Description
 *
 * Add event listeners with async reentry protection and semantic Interactions. Shorthand for `createContainer` without options.
 *
 * @example
 * import { on } from 'remix/interaction'
 * import { longPress } from 'remix/interaction/press'
 *
 * let button = document.createElement('button')
 * let dispose = on(button, {
 *   click(event, signal) {
 *     console.log('clicked')
 *   },
 *   [longPress](event) {
 *     console.log('long pressed')
 *   },
 * })
 *
 * // later
 * dispose()
 *
 * @param target The event target to add listeners to
 * @param listeners The event listeners to add
 * @returns A function to dispose all listeners
 */
export declare function on<target extends EventTarget>(target: target, listeners: EventListeners<target>): () => void;
/**
 * An `EventTarget` subclass with typed event maps.
 */
export declare class TypedEventTarget<eventMap> extends EventTarget {
    readonly __eventMap?: eventMap;
}
export interface TypedEventTarget<eventMap> {
    addEventListener<type extends Extract<keyof eventMap, string>>(type: type, listener: TypedEventListener<eventMap>[type], options?: AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<type extends Extract<keyof eventMap, string>>(type: type, listener: TypedEventListener<eventMap>[type], options?: EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: EventListenerOptions): void;
}
type TypedEventListener<eventMap> = {
    [key in keyof eventMap]: (event: eventMap[key]) => void;
};
type ListenerOrDescriptor<Listener> = Listener | Descriptor<Listener>;
interface Descriptor<L> extends AddEventListenerOptions {
    listener: L;
}
type SignaledListener<event extends Event> = (event: event, signal: AbortSignal) => void | Promise<void>;
type EnsureEvent<event, target extends EventTarget> = event extends Event ? Dispatched<event, target> : never;
type EventType<target extends EventTarget> = target extends {
    __eventMap?: infer eventMap;
} ? keyof eventMap : keyof EventMap<target>;
type ListenerFor<target extends EventTarget, k extends EventType<target>> = SignaledListener<EnsureEvent<EventMap<target>[k], target>>;
type EventMap<target extends EventTarget> = (target extends {
    __eventMap?: infer eventMap;
} ? eventMap : target extends HTMLElement ? HTMLElementEventMap : target extends SVGSVGElement ? SVGSVGElementEventMap : target extends SVGElement ? SVGElementEventMap : target extends Element ? ElementEventMap : target extends Window ? WindowEventMap : target extends Document ? DocumentEventMap : target extends AbortSignal ? AbortSignalEventMap : target extends Animation ? AnimationEventMap : target extends AudioDecoder ? AudioDecoderEventMap : target extends AudioEncoder ? AudioEncoderEventMap : target extends AudioNode ? GlobalEventHandlersEventMap : target extends BaseAudioContext ? BaseAudioContextEventMap : target extends BroadcastChannel ? BroadcastChannelEventMap : target extends Clipboard ? GlobalEventHandlersEventMap : target extends EventSource ? EventSourceEventMap : target extends FileReader ? FileReaderEventMap : target extends FontFaceSet ? FontFaceSetEventMap : target extends IDBDatabase ? IDBDatabaseEventMap : target extends IDBTransaction ? IDBTransactionEventMap : target extends MIDIAccess ? MIDIAccessEventMap : target extends MIDIPort ? MIDIPortEventMap : target extends MediaDevices ? MediaDevicesEventMap : target extends MediaKeySession ? MediaKeySessionEventMap : target extends MediaQueryList ? MediaQueryListEventMap : target extends MediaRecorder ? MediaRecorderEventMap : target extends MediaSource ? MediaSourceEventMap : target extends MediaStream ? MediaStreamEventMap : target extends MediaStreamTrack ? MediaStreamTrackEventMap : target extends MessagePort ? MessagePortEventMap : target extends Node ? GlobalEventHandlersEventMap : target extends Notification ? NotificationEventMap : target extends OffscreenCanvas ? OffscreenCanvasEventMap : target extends PaymentRequest ? PaymentRequestEventMap : target extends PaymentResponse ? PaymentResponseEventMap : target extends Performance ? PerformanceEventMap : target extends PermissionStatus ? PermissionStatusEventMap : target extends PictureInPictureWindow ? PictureInPictureWindowEventMap : target extends RTCDTMFSender ? RTCDTMFSenderEventMap : target extends RTCDataChannel ? RTCDataChannelEventMap : target extends RTCDtlsTransport ? RTCDtlsTransportEventMap : target extends RTCIceTransport ? RTCIceTransportEventMap : target extends RTCPeerConnection ? RTCPeerConnectionEventMap : target extends RTCSctpTransport ? RTCSctpTransportEventMap : target extends RemotePlayback ? RemotePlaybackEventMap : target extends ScreenOrientation ? ScreenOrientationEventMap : target extends ServiceWorkerContainer ? ServiceWorkerContainerEventMap : target extends ServiceWorkerRegistration ? ServiceWorkerRegistrationEventMap : target extends ServiceWorker ? AbstractWorkerEventMap : target extends SharedWorker ? AbstractWorkerEventMap : target extends SourceBuffer ? SourceBufferEventMap : target extends SourceBufferList ? SourceBufferListEventMap : target extends SpeechSynthesis ? SpeechSynthesisEventMap : target extends SpeechSynthesisUtterance ? SpeechSynthesisUtteranceEventMap : target extends TextTrack ? TextTrackEventMap : target extends TextTrackCue ? TextTrackCueEventMap : target extends TextTrackList ? TextTrackListEventMap : target extends VideoDecoder ? VideoDecoderEventMap : target extends VideoEncoder ? VideoEncoderEventMap : target extends VisualViewport ? VisualViewportEventMap : target extends WakeLockSentinel ? WakeLockSentinelEventMap : target extends WebSocket ? WebSocketEventMap : target extends Window ? (WindowEventMap & GlobalEventHandlersEventMap) : target extends Worker ? AbstractWorkerEventMap : target extends XMLHttpRequestEventTarget ? XMLHttpRequestEventTargetEventMap : GlobalEventHandlersEventMap & Record<string, Event>);
export {};
