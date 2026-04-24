/** Records the arguments, return value, and any thrown error for a single call. */
export interface MockCall<Args extends unknown[] = unknown[], Result = unknown> {
  arguments: Args
  result?: Result
  error?: unknown
}

/**
 * Metadata attached to every mock/spy function via its `.mock` property.
 * `restore` is present on spies and reverts the original method when called.
 */
export interface MockContext<Args extends unknown[] = unknown[], Result = unknown> {
  calls: MockCall<Args, Result>[]
  restore?: () => void
}

/** A function augmented with a `.mock` property for inspecting recorded calls. */
export type MockFunction<T extends (...args: any[]) => any = (...args: any[]) => any> = T & {
  mock: MockContext<Parameters<T>, ReturnType<T>>
}

function createMockFn<T extends (...args: any[]) => any>(impl?: T): MockFunction<T> {
  let calls: MockCall<Parameters<T>, ReturnType<T>>[] = []

  let fn = function (this: unknown, ...args: Parameters<T>): ReturnType<T> {
    let call: MockCall<Parameters<T>, ReturnType<T>> = { arguments: args }
    calls.push(call)
    if (impl) {
      try {
        let result = impl.apply(this, args)
        call.result = result
        return result
      } catch (error) {
        call.error = error
        throw error
      }
    }
    return undefined as ReturnType<T>
  } as MockFunction<T>

  fn.mock = { calls }
  return fn
}

function createMethodMock<T extends object, K extends keyof T>(
  obj: T,
  method: K,
  impl?: T[K] extends (...args: any[]) => any ? (...args: Parameters<T[K]>) => any : never,
): MockFunction {
  let original = obj[method]
  let effectiveImpl = (impl ?? original) as (...args: any[]) => any
  let mockFn = createMockFn(effectiveImpl)
  obj[method] = mockFn as unknown as T[K]
  mockFn.mock.restore = () => {
    obj[method] = original
  }
  return mockFn
}

/**
 * Utilities for creating mock functions and method spies. Mirrors the names
 * on Node.js's built-in `MockTracker` from `node:test`.
 *
 * @example
 * // Standalone mock
 * const fn = mock.fn((x: number) => x * 2)
 * fn(3)
 * assert.equal(fn.mock.calls[0].result, 6)
 *
 * // Mock an existing method
 * const spy = mock.method(console, 'log')
 * console.log('hello')
 * assert.equal(spy.mock.calls.length, 1)
 * spy.mock.restore?.()
 */
export const mock = {
  /**
   * Creates a mock function that records every call. If `impl` is provided it
   * is used as the underlying implementation; otherwise the mock returns
   * `undefined`.
   */
  fn: createMockFn,
  /**
   * Replaces `obj[methodName]` with a mock and records every call. The
   * original method is used as the implementation unless `impl` is provided.
   * Call `mockFn.mock.restore()` to revert.
   */
  method: createMethodMock,
}
