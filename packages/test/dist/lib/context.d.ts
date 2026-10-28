import type { Browser, Page } from 'playwright';
import type { V8CoverageEntry } from './coverage.ts';
import { type FakeTimers } from './fake-timers.ts';
import { mock, type MockCall, type MockContext, type MockFunction } from './mock.ts';
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
 * Test Context providing utilities for the Remix test runner. The context is
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
     * An abort signal for the current test. The signal is aborted when the test
     * times out or when a user-provided test signal aborts.
     */
    signal: AbortSignal;
    /**
     * Registers a cleanup function to be called after the test completes.
     *
     * @param {() => void} fn - The cleanup function to execute
     * @returns {void}
     */
    after(fn: () => void): void;
    /**
     * Function mocks and method spies using {@link mock}, restored automatically after the test.
     * Mock restoration and test cleanup callbacks run in registration order, even after failures.
     */
    mock: {
        /**
         * Creates a function mock that is restored after the test.
         * @param impl The implementation to call; omitted mocks return `undefined`.
         * @returns A mock with call history and controls typed to the implementation.
         */
        fn<fn extends (...args: any[]) => any>(impl: fn): MockFunction<fn>;
        fn<fn extends (...args: any[]) => any>(impl?: fn): MockFunction<fn>;
        /**
         * Creates a method spy that is restored after the test.
         * @param obj The object whose method will be mocked.
         * @param methodName The method to replace.
         * @param impl Optional initial implementation, retaining support for overloaded methods.
         * @returns A spy with permissive calls and replacement controls typed to the original method.
         */
        method<T extends object, K extends keyof T>(obj: T, methodName: K, impl?: Function): ReturnType<typeof mock.method<T, K>>;
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
     * {@link createTestServer} from `@remix-run/node-fetch-server/test` to spin
     * up the server.
     *
     * @param server - The running server the page should target
     * @returns A `Page` whose `baseURL` is set to `server.baseUrl`.
     */
    serve(server: TestServer): Promise<Page>;
}
export interface CreateTestContextOptions {
    signal: AbortSignal;
    e2e?: CreateTestContextE2EOptions;
}
export interface CreateTestContextE2EOptions {
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