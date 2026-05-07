import type { Browser, Page } from 'playwright';
import type { V8CoverageEntry } from './coverage.ts';
import { type FakeTimers } from './fake-timers.ts';
import { type MockCall, type MockContext, type MockFunction } from './mock.ts';
import type { getPlaywrightPageOptions } from './playwright.ts';
/**
 * The shape `t.serve()` consumes. Matches the result of `createTestServer`
 * from `@remix-run/node-fetch-server/test`, but any object with a `baseUrl`
 * and async `close()` works.
 */
export interface TestServer {
    baseUrl: string;
    close(): Promise<void>;
}
/**
 * Test Context providing utilities for testing via remix-test.  The context is
 * passed as the first argument to the {@link test}/{@link it} functions.
 *
 * @example
 * describe('my test suite', () => {
 *   it('my test case', async (t) => {
 *     let mockFn = t.mock.fn(() => 'mocked value')
 *     // ...
 *   })
 * })
 */
export interface TestContext {
    /**
     * Registers a cleanup function to be called after the test completes.
     *
     * @param {() => void} fn - The cleanup function to execute
     * @returns {void}
     */
    after(fn: () => void): void;
    /**
     * Mock tracker for the current test. Mirrors the shape of Node's
     * `t.mock`. Method mocks created here are auto-restored on test completion.
     */
    mock: {
        /**
         * Creates a mock function with an optional implementation.
         *
         * @template T - The function type to be mocked
         * @param {T} [impl] - Optional custom implementation for the mock
         * @returns {MockFunction<T>} A mock function instance
         */
        fn<T extends (...args: any[]) => any>(impl?: T): MockFunction<T>;
        /**
         * Replaces `obj[methodName]` with a mock and records every call. The
         * original method is restored automatically after the test completes.
         *
         * @template T - The object type
         * @template K - The method key of the object
         * @param {T} obj - The object to mock
         * @param {K} methodName - The method name to mock
         * @param {Function} [impl] - Optional implementation override (must be a function)
         * @returns {MockFunction} A mock function instance for the mocked method
         */
        method<T extends object, K extends keyof T>(obj: T, methodName: K, impl?: Function): MockFunction;
    };
    /**
     * Activates fake timers for testing time-dependent code.
     *
     * @returns {FakeTimers} A fake timers instance for controlling time
     */
    useFakeTimers(): FakeTimers;
    /**
     * Wires a running test server up to a Playwright page so the test can drive
     * it. The server is closed automatically when the test ends. Pair with
     * `createTestServer` from `@remix-run/node-fetch-server/test` (or any other
     * source of a `{ baseUrl, close }` handle) to spin up the server first.
     *
     * @param server - The running server the page should target
     * @returns A `Page` whose `baseURL` is set to `server.baseUrl`.
     */
    serve(server: TestServer): Promise<Page>;
}
export interface CreateTestContextOptions {
    addE2ECoverageEntries: (value: {
        entries: V8CoverageEntry[];
        baseUrl: string;
    }) => void;
    browser: Browser;
    coverage: boolean;
    open: boolean;
    playwrightPageOptions: ReturnType<typeof getPlaywrightPageOptions>;
}
export declare function createTestContext(options?: CreateTestContextOptions): {
    testContext: TestContext;
    cleanup(): Promise<void>;
};
export type { MockCall, MockContext, MockFunction };
//# sourceMappingURL=context.d.ts.map