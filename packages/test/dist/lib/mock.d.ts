/** Records the arguments, return value, and any thrown error for a single call. */
export interface MockCall<Args extends unknown[] = unknown[], Result = unknown> {
    arguments: Args;
    result?: Result;
    error?: unknown;
}
/**
 * Metadata attached to every mock/spy function via its `.mock` property.
 * `restore` is present on spies and reverts the original method when called.
 */
export interface MockContext<Args extends unknown[] = unknown[], Result = unknown> {
    calls: MockCall<Args, Result>[];
    restore?: () => void;
}
/** A function augmented with a `.mock` property for inspecting recorded calls. */
export type MockFunction<T extends (...args: any[]) => any = (...args: any[]) => any> = T & {
    mock: MockContext<Parameters<T>, ReturnType<T>>;
};
declare function createMockFn<T extends (...args: any[]) => any>(impl?: T): MockFunction<T>;
declare function createSpy<T extends object, K extends keyof T>(obj: T, method: K, impl?: T[K] extends (...args: any[]) => any ? (...args: Parameters<T[K]>) => any : never): MockFunction;
/**
 * Utilities for creating mock functions and spies.
 *
 * @example
 * // Standalone mock
 * const fn = mock.fn((x: number) => x * 2)
 * fn(3)
 * assert.equal(fn.mock.calls[0].result, 6)
 *
 * // Spy on an existing method
 * const spy = mock.spyOn(console, 'log')
 * console.log('hello')
 * assert.equal(spy.mock.calls.length, 1)
 * spy.mock.restore?.()
 */
export declare const mock: {
    /**
     * Creates a mock function that records every call. If `impl` is provided it
     * is used as the underlying implementation; otherwise the mock returns
     * `undefined`.
     */
    fn: typeof createMockFn;
    /**
     * Replaces `obj[method]` with a spy and records every call. The original
     * method is used as the implementation unless `impl` is provided. Call
     * `spy.mock.restore()` to revert.
     */
    spyOn: typeof createSpy;
};
export {};
//# sourceMappingURL=mock.d.ts.map