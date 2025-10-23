import type { Assert, Equal } from '../test/utils'

type TypedEventListener<EventMap> = {
  [K in keyof EventMap]: (event: EventMap[K]) => void
}

export class TypedEventTarget<EventMap> extends EventTarget {
  declare readonly __eventMap?: EventMap
}

export interface TypedEventTarget<EventMap> {
  // typed
  addEventListener<K extends Extract<keyof EventMap, string>>(
    type: K,
    listener: TypedEventListener<EventMap>[K],
    options?: AddEventListenerOptions,
  ): void
  // base
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void

  // typed
  removeEventListener<K extends Extract<keyof EventMap, string>>(
    type: K,
    listener: TypedEventListener<EventMap>[K],
    options?: EventListenerOptions,
  ): void
  // base
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions,
  ): void
}

// prettier-ignore
type BuiltinEventsFor<T extends EventTarget> = 
  T extends HTMLElement ? HTMLElementEventMap :
  T extends Element ? ElementEventMap :
  T extends Window ? WindowEventMap :
  T extends Document ? DocumentEventMap :
  T extends Worker ? WorkerEventMap :
  T extends ServiceWorker ? ServiceWorkerEventMap :
  T extends WebSocket ? WebSocketEventMap :
  T extends MessagePort ? MessagePortEventMap :
  GlobalEventHandlersEventMap & Record<string, Event>

type EventMapOf<T> =
  T extends TypedEventTarget<infer M>
    ? '__eventMap' extends keyof T
      ? M
      : never
    : '__eventMap' extends keyof T
      ? Exclude<T['__eventMap'], undefined>
      : never

// If no map, use built-ins; otherwise use the custom map.
export type EventsFor<T extends EventTarget> = [EventMapOf<T>] extends [never]
  ? BuiltinEventsFor<T>
  : EventMapOf<T>

type EventMapFromAddEventListener<F> = F extends {
  <K extends keyof (infer M)>(type: K, listener: any, options?: any): any
}
  ? M
  : never

type A = HTMLElement['addEventListener']
type Types = EventMapFromAddEventListener<A>

let a: Types = 'click'

////////////////////////////////////////////////////////////////////////////////
interface DrummerEventMap {
  click: DrummerEvent
  change: DrummerEvent
  kick: DrummerEvent
  snare: DrummerEvent
  hat: DrummerEvent
}

class DrummerEvent extends Event {
  constructor(public type: keyof DrummerEventMap) {
    super(type)
  }
}

class Drummer extends TypedEventTarget<DrummerEventMap> {
  // ...
}

type H1 = BuiltinEventsFor<HTMLElement>
type T1 = Assert<Equal<H1, HTMLElementEventMap>>

type H2 = EventsFor<HTMLElement>
type T2 = Assert<Equal<H2, HTMLElementEventMap>>

type D = EventsFor<Drummer> // play, kick, snare, hat
type T3 = Assert<Equal<D, DrummerEventMap>>

let drummer = new Drummer()
drummer.addEventListener('', (event) => {
  console.log(event) // DrummerEvent
})
