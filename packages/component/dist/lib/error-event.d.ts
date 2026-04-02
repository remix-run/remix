/**
 * Error event shape emitted by the component runtime.
 */
export type ComponentErrorEvent = ErrorEvent & {
    readonly error: unknown;
};
/**
 * Creates a normalized component error event from any thrown value.
 *
 * @param error Error-like value to expose on the event.
 * @returns An `error` event carrying the original value.
 */
export declare function createComponentErrorEvent(error: unknown): ComponentErrorEvent;
/**
 * Reads the `.error` payload from a dispatched component error event.
 *
 * @param event Event to inspect.
 * @returns The original error value, if present.
 */
export declare function getComponentError(event: Event): unknown;
