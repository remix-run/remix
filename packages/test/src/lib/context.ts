import type { Browser, Page } from 'playwright'
import type { V8CoverageEntry } from './coverage.ts'
import { createFakeTimers, type FakeTimers } from './fake-timers.ts'
import { mock, type MockCall, type MockContext, type MockFunction } from './mock.ts'
import type { getPlaywrightPageOptions } from './playwright.ts'

/**
 * The shape `t.serve()` consumes. Matches the result of `createTestServer`
 * from `@remix-run/node-fetch-server/test`, but any object with a `baseUrl`
 * and async `close()` works.
 */
export interface TestServer {
  baseUrl: string
  close(): Promise<void>
}

/**
 * Test Context providing utilities for testing via `remix-test`.  The context is
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
  after(fn: () => void): void

  /**
   * Mock tracker for the current test using {@link mock}. Mirrors the shape of Node's
   * `t.mock`. Method mocks created via `t.mock` are auto-restored on test completion.
   */
  mock: {
    /**
     * Creates a mock function with an optional implementation.
     *
     * @template T - The function type to be mocked
     * @param {T} [impl] - Optional custom implementation for the mock
     * @returns {MockFunction<T>} A mock function instance
     */
    fn<T extends (...args: any[]) => any>(impl?: T): MockFunction<T>

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
    method<T extends object, K extends keyof T>(
      obj: T,
      methodName: K,
      impl?: Function,
    ): MockFunction
  }

  /**
   * Activates fake timers for testing time-dependent code.
   *
   * @returns {FakeTimers} A fake timers instance for controlling time
   */
  useFakeTimers(): FakeTimers

  /**
   * Wires a running test server up to a Playwright page so the test can drive
   * it. The server is closed automatically when the test ends. Pair with
   * {@link createTestServer} from `@remix-run/node-fetch-server/test` to spin
   * up the server.
   *
   * @param server - The running server the page should target
   * @returns A `Page` whose `baseURL` is set to `server.baseUrl`.
   */
  serve(server: TestServer): Promise<Page>
}

export interface CreateTestContextOptions {
  addE2ECoverageEntries: (value: { entries: V8CoverageEntry[]; baseUrl: string }) => void
  browser: Browser
  coverage: boolean
  open: boolean
  playwrightPageOptions: ReturnType<typeof getPlaywrightPageOptions>
}

export function createTestContext(options?: CreateTestContextOptions): {
  testContext: TestContext
  cleanup(): Promise<void>
} {
  let cleanups: Array<() => void | Promise<void>> = []

  let testContext: TestContext = {
    mock: {
      fn: mock.fn,
      method(obj, methodName, impl) {
        let mockFn = mock.method(obj, methodName, impl as any)
        if (mockFn.mock.restore) cleanups.push(mockFn.mock.restore)
        return mockFn
      },
    },
    after(fn) {
      cleanups.push(fn)
    },
    useFakeTimers() {
      let timers = createFakeTimers()
      cleanups.push(timers.restore)
      return timers
    },
    async serve(server) {
      if (!options || !options.browser) {
        throw new Error('t.serve() is only available in E2E test suites')
      }

      let page = await options.browser.newPage({
        ...options.playwrightPageOptions,
        baseURL: server.baseUrl,
      })
      if (options.playwrightPageOptions?.navigationTimeout != null) {
        page.setDefaultNavigationTimeout(options.playwrightPageOptions.navigationTimeout)
      }
      if (options.playwrightPageOptions?.actionTimeout != null) {
        page.setDefaultTimeout(options.playwrightPageOptions.actionTimeout)
      }

      let coverageEnabled = options.coverage && options.browser.browserType().name() === 'chromium'
      if (coverageEnabled) {
        await page.coverage.startJSCoverage({ resetOnNavigation: false })
        cleanups.push(async () => {
          let entries = await page.coverage.stopJSCoverage()
          options.addE2ECoverageEntries?.({
            entries: entries as unknown as V8CoverageEntry[],
            baseUrl: server.baseUrl,
          })
        })
      }

      cleanups.push(async () => {
        if (!options.open) {
          await page.close()
        }
        await server.close()
      })

      return page
    },
  }

  return {
    testContext,
    async cleanup() {
      for (let fn of cleanups) await fn()
      cleanups.length = 0
    },
  }
}

export type { MockCall, MockContext, MockFunction }
