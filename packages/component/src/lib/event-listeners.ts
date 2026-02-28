export type Dispatched<event extends Event, target extends EventTarget> = Omit<
  event,
  'currentTarget'
> & {
  currentTarget: target
}

export type EnsureEvent<event, target extends EventTarget> = event extends Event
  ? Dispatched<event, target>
  : never

export type EventType<target extends EventTarget> = target extends { __eventMap?: infer eventMap }
  ? keyof eventMap
  : keyof EventMap<target>

type NavigationTarget = Window extends { navigation: infer navigation } ? navigation : never
type NavigationTargetEvent = NavigationTarget extends {
  onnavigate: ((event: infer navigateEvent) => unknown) | null
}
  ? navigateEvent
  : Event
type NavigationTargetEventMap = {
  navigate: NavigationTargetEvent
}

export type ListenerFor<target extends EventTarget, type extends EventType<target>> = (
  event: EnsureEvent<EventMap<target>[type], target>,
  signal: AbortSignal,
) => void

export type EventListeners<target extends EventTarget> = Partial<{
  [k in EventType<target>]: ListenerFor<target, k>
}>

// prettier-ignore
export type EventMap<target extends EventTarget> = (
  // TypedEventTarget
  target extends { __eventMap?: infer eventMap } ? eventMap :

  // elements
  target extends HTMLElement ? HTMLElementEventMap :
  target extends SVGSVGElement ? SVGSVGElementEventMap :
  target extends SVGElement ? SVGElementEventMap :
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
  target extends NavigationTarget ? NavigationTargetEventMap :
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
)

export function addEventListeners<target extends EventTarget>(
  target: target,
  signal: AbortSignal,
  listeners: EventListeners<target>,
) {
  type AnyEvent = EnsureEvent<EventMap<target>[EventType<target>], target>
  type Listener = (event: AnyEvent, signal?: AbortSignal) => void

  for (let type in listeners) {
    let listener = listeners[type as EventType<target>] as Listener
    if (!listener) continue
    let reentry: AbortController | null = null

    signal.addEventListener('abort', () => {
      reentry?.abort()
    })

    target.addEventListener(
      type,
      (event) => {
        reentry?.abort()
        let dispatchedEvent = event as AnyEvent

        if (listener.length < 2) {
          reentry = null
          listener(dispatchedEvent)
        } else {
          reentry = new AbortController()
          listener(dispatchedEvent, reentry.signal)
        }
      },
      { signal },
    )
  }
}
