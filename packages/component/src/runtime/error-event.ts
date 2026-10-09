/**
 * Error event shape emitted by the component runtime.
 */
export type ComponentErrorEvent = ErrorEvent & {
  readonly error: unknown
}

/**
 * Creates a normalized component error event from any thrown value.
 *
 * @param error Error-like value to expose on the event.
 * @returns An `error` event carrying the original value.
 */
export function createComponentErrorEvent(error: unknown): ComponentErrorEvent {
  return new ErrorEvent('error', { error }) as ComponentErrorEvent
}

/**
 * Reads the `.error` payload from a dispatched component error event.
 *
 * @param event Event to inspect.
 * @returns The original error value, if present.
 */
export function getComponentError(event: Event): unknown {
  return (event as { error?: unknown }).error
}
