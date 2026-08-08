export const ssrSignal = Object.freeze({
  get aborted() {
    return false
  },
  get reason() {
    return undefined
  },
  get onabort() {
    return null
  },
  set onabort(_: AbortSignal['onabort']) {},
  addEventListener(
    _type: string,
    _listener: EventListenerOrEventListenerObject | null,
    _options?: AddEventListenerOptions | boolean,
  ) {},
  removeEventListener(
    _type: string,
    _listener: EventListenerOrEventListenerObject | null,
    _options?: EventListenerOptions | boolean,
  ) {},
  dispatchEvent(_event: Event) {
    return true
  },
  throwIfAborted() {},
}) as AbortSignal

export function isSsrSignal(signal: AbortSignal): boolean {
  return signal === ssrSignal
}
