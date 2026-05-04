export interface FakeTimers {
    advance(ms: number): void;
    /**
     * Like `advance`, but yields to microtasks between each timer firing so
     * Promise continuations (and any timers they schedule) can settle before
     * the next firing is processed. Use this when a callback awaits work that
     * itself depends on the fake clock.
     */
    advanceAsync(ms: number): Promise<void>;
    restore(): void;
}
export declare function createFakeTimers(): FakeTimers;
//# sourceMappingURL=fake-timers.d.ts.map