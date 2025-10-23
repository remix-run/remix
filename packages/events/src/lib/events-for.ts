import type { TypedEventTarget } from './target'

// prettier-ignore
export type BuiltinEventsFor<T extends EventTarget> = 
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
