/**
 * Handle returned by `mock.timers.enable()` for driving fake timers during a
 * test. While enabled, `setTimeout`, `setInterval`, `clearTimeout`,
 * `clearInterval`, and `Date.now` use the fake clock instead of the real one;
 * timers fire only when the test calls `advance` (or `advanceAsync`).
 *
 * @example
 * ```ts
 * it('debounces save calls', (t) => {
 *   let timers = t.mock.timers.enable()
 *   let save = t.mock.fn()
 *   let debounced = debounce(save, 100)
 *   debounced(); debounced(); debounced()
 *   timers.advance(100)
 *   assert.equal(save.mock.calls.length, 1)
 * })
 * ```
 */
export interface FakeTimers {
    /**
     * Advance the fake clock by `ms` milliseconds, synchronously firing every
     * timer whose deadline is reached during the advance.
     *
     * @param ms Number of milliseconds to advance.
     */
    advance(ms: number): void;
    /**
     * Like `advance`, but yields to microtasks between each timer firing so
     * Promise continuations (and any timers they schedule) can settle before
     * the next firing is processed. Use this when a callback awaits work that
     * itself depends on the fake clock.
     *
     * @param ms Number of milliseconds to advance.
     * @returns A promise that resolves once all reachable timers have fired.
     */
    advanceAsync(ms: number): Promise<void>;
    /**
     * Restore the original timer functions and the real clock. Called
     * automatically after the test finishes; may also be called early to
     * disable fake timers mid-test.
     */
    restore(): void;
}
export declare function createFakeTimers(): FakeTimers;
//# sourceMappingURL=fake-timers.d.ts.map