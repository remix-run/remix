export class GuardedEventTarget extends EventTarget {
  #onListenerError: (error: unknown) => void
  #wrappedListeners = new WeakMap<EventListenerOrEventListenerObject, EventListener>()

  constructor(onListenerError: (error: unknown) => void) {
    super()
    this.#onListenerError = onListenerError
  }

  override addEventListener(
    type: string,
    listener: null | EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) {
    if (!listener) return
    let wrapped = this.#wrappedListeners.get(listener)
    if (!wrapped) {
      wrapped = (event) => {
        try {
          if (typeof listener === 'function') {
            listener(event)
          } else {
            listener.handleEvent(event)
          }
        } catch (error) {
          this.#onListenerError(error)
        }
      }
      this.#wrappedListeners.set(listener, wrapped)
    }
    super.addEventListener(type, wrapped, options)
  }

  override removeEventListener(
    type: string,
    listener: null | EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ) {
    if (!listener) return
    let wrapped = this.#wrappedListeners.get(listener)
    super.removeEventListener(type, wrapped ?? listener, options)
  }
}
