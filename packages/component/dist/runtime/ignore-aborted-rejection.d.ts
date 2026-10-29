/**
 * Ignores a rejection from async runtime work once that work's signal has been
 * aborted. Rejections from work whose signal is still live are re-thrown so
 * they continue to surface as unhandled rejections.
 *
 * @param result The value returned by an event handler or task.
 * @param signal The signal passed to that handler or task.
 */
export declare function ignoreAbortedRejection(result: unknown, signal: AbortSignal): void;
