type TypedEventListener<EventMap> = {
  [K in keyof EventMap]: (event: EventMap[K]) => void
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
