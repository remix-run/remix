/**
 * Creates a normalized component error event from any thrown value.
 *
 * @param error Error-like value to expose on the event.
 * @returns An `error` event carrying the original value.
 */
export function createComponentErrorEvent(error) {
    return new ErrorEvent('error', { error });
}
/**
 * Reads the `.error` payload from a dispatched component error event.
 *
 * @param event Event to inspect.
 * @returns The original error value, if present.
 */
export function getComponentError(event) {
    return event.error;
}
//# sourceMappingURL=error-event.js.map