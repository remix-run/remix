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
  signal: AbortSignal

  /**
   * Registers a cleanup function to be called after the test completes.
   *
   * @param {() => void} fn - The cleanup function to execute
   * @returns {void}
   */
  after(fn: () => void): void

  /**
   * Mock tracker for the current test using {@link mock}. Mirrors the shape of Node's
   * `t.mock`. Mock restoration and test cleanup callbacks run in registration order.
   */
  mock: {
    /** Creates a function mock that is restored after the test. */
    fn: typeof mock.fn
    /**
     * Creates a method spy that is restored after the test.
     * @param obj The object whose method will be mocked.
     * @param methodName The method to replace.
     * @param impl Optional initial implementation, retaining support for overloaded methods.
     * @returns A spy with permissive calls and replacement controls typed to the original method.
     */
    method<T extends object, K extends keyof T>(
      obj: T,
      methodName: K,
      impl?: Function,
    ): ReturnType<typeof mock.method<T, K>>
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
  signal: AbortSignal
  e2e?: CreateTestContextE2EOptions
}

export interface CreateTestContextE2EOptions {
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
    signal: options?.signal ?? new AbortController().signal,
    mock: {
      fn(impl) {
        let mockFn = mock.fn(impl)
        cleanups.push(mockFn.mock.restore)
        return mockFn
      },
      method(obj, methodName, impl) {
        // Keep the existing permissive initial override for overloaded methods.
        let mockFn = mock.method(
          obj,
          methodName,
          impl as Parameters<typeof mock.method<typeof obj, typeof methodName>>[2],
        )
        cleanups.push(mockFn.mock.restore)
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
      let e2e = options?.e2e
      if (!e2e) {
        throw new Error('t.serve() is only available in E2E test suites')
      }

      let page = await e2e.browser.newPage({
        ...e2e.playwrightPageOptions,
        baseURL: server.baseUrl,
      })
      if (e2e.playwrightPageOptions?.navigationTimeout != null) {
        page.setDefaultNavigationTimeout(e2e.playwrightPageOptions.navigationTimeout)
      }
      if (e2e.playwrightPageOptions?.actionTimeout != null) {
        page.setDefaultTimeout(e2e.playwrightPageOptions.actionTimeout)
      }

      let coverageEnabled = e2e.coverage && e2e.browser.browserType().name() === 'chromium'
      if (coverageEnabled) {
        await page.coverage.startJSCoverage({ resetOnNavigation: false })
        cleanups.push(async () => {
          let entries = await page.coverage.stopJSCoverage()
          e2e.addE2ECoverageEntries?.({
            entries: entries as unknown as V8CoverageEntry[],
            baseUrl: server.baseUrl,
          })
        })
      }

      cleanups.push(async () => {
        if (!e2e.open) {
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
      let errors: unknown[] = []
      for (let fn of cleanups) {
        try {
          await fn()
        } catch (error) {
          errors.push(error)
        }
      }
      cleanups.length = 0
      if (errors.length === 1) throw errors[0]
      if (errors.length > 1) {
        throw new AggregateError(
          errors,
          errors
            .map((error) => (error instanceof Error ? error.message : String(error)))
            .join('\n'),
        )
      }
    },
  }
}

export type { MockCall, MockContext, MockFunction }
