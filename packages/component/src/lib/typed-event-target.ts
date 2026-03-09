/**
 * An `EventTarget` subclass with typed event maps.
 */
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
