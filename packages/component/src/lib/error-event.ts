/**
 * Error event shape emitted by the component runtime.
 */
export type ComponentErrorEvent = ErrorEvent & {
  readonly error: unknown
}

export function createComponentErrorEvent(error: unknown): ComponentErrorEvent {
  return new ErrorEvent('error', { error }) as ComponentErrorEvent
}

export function getComponentError(event: Event): unknown {
  return (event as { error?: unknown }).error
}
