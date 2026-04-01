import type { Browser, Page } from 'playwright'
import { createFakeTimers, type FakeTimers } from './fake-timers.ts'
import { mock, type MockFunction, type MockCall, type MockContext } from './mock.ts'
import type { render } from './render.ts'

import type { CreateServerFunction } from './e2e-server.ts'
import type { getPlaywrightPageOptions } from './playwright.ts'
import type { RemixNode, VirtualRoot, VirtualRootOptions } from '@remix-run/component'

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
  after(fn: () => void): void

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
   * Renders a component for testing purposes.
   *
   * @param node - The component node to render
   * @param opts.container - An optional container element to render into (defaults to a new div appended to the document body)
   * @returns An object containing the rendered container, root, and utility
   * functions for querying and interacting with the rendered output
   */
  render(
    node: RemixNode,
    opts?: { container?: HTMLElement } & VirtualRootOptions,
  ): {
    container: HTMLElement
    root: VirtualRoot
    $: (s: string) => HTMLElement | null
    $$: (s: string) => NodeListOf<HTMLElement>
    act: (fn: () => unknown | Promise<unknown>) => Promise<void>
    cleanup: () => void
  }

  /**
   * Starts a test server with the provided request handler.
   *
   * @param {(req: Request) => Promise<Response>} handler - Function handling incoming requests
   * @returns {Promise<Page>} A promise resolving to a page instance for the server
   */
  serve(handler: (req: Request) => Promise<Response>): Promise<Page>
}

export function createTestContext(options: {
  render?: TestContext['render']
  createServer?: CreateServerFunction
  browser?: Browser
  open?: boolean
  playwrightPageOptions?: ReturnType<typeof getPlaywrightPageOptions>
}): { testContext: TestContext; cleanup(): Promise<void> } {
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
    render(node, opts) {
      if (!options.render) {
        throw new Error('t.render() is only available in browser test suites')
      }

      let result = options.render(node, opts)
      cleanups.push(result.cleanup)
      return result
    },
    async serve(handler) {
      if (!options.createServer || !options.browser) {
        throw new Error('t.serve() is only available in E2E test suites')
      }

      let server = await options.createServer(handler)
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
