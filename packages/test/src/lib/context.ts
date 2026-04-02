import { mock, type MockFunction, type MockCall, type MockContext } from './mock.ts'

/**
 * Test Context providing utilities for testing via remix-test.  The context is
 * passed as the first argument to the {@link test}/{@link it} functions.
 *
 * @example
 * describe('my test suite', () => {
 *   it('my test case', async (t) => {
 *     let mockFn = t.mock(() => 'mocked value')
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
   * Creates a mock function with an optional implementation.
   *
   * @template T - The function type to be mocked
   * @param {T} [impl] - Optional custom implementation for the mock
   * @returns {MockFunction<T>} A mock function instance
   */
  mock<T extends (...args: any[]) => any>(impl?: T): MockFunction<T>

  /**
   * Creates a spy on an object's method with optional implementation override.
   *
   * @template T - The object type
   * @template K - The method key of the object
   * @param {T} obj - The object to spy on
   * @param {K} method - The method name to spy on
   * @param {T[K]} [impl] - Optional implementation override (must be a function)
   * @returns {MockFunction} A mock function instance for the spied method
   */
  spyOn<T extends object, K extends keyof T>(
    obj: T,
    method: K,
    impl?: T[K] extends (...args: any[]) => any ? T[K] : never,
  ): MockFunction
}

export function createTestContext(): { testContext: TestContext; cleanup(): Promise<void> } {
  let cleanups: Array<() => void | Promise<void>> = []

  let testContext: TestContext = {
    mock: mock.fn,
    spyOn(obj, method, impl) {
      let mockFn = mock.spyOn(obj, method, impl as any)
      if (mockFn.mock.restore) cleanups.push(mockFn.mock.restore)
      return mockFn
    },
    after(fn) {
      cleanups.push(fn)
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

export type { MockFunction, MockCall, MockContext }
