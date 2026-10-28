/** Records the arguments, return value, and any thrown error for a single call. */
export interface MockCall<Args extends unknown[] = unknown[], Result = unknown> {
  /** Arguments supplied to this call. */
  arguments: Args
  /** The returned value, including an unawaited promise for async calls. */
  result?: Result
  /** The value thrown synchronously by this call. */
  error?: unknown
}

/**
 * Metadata attached to every mock/spy function via its `.mock` property.
 * Calls are recorded before the implementation runs, including reentrant calls.
 */
export interface MockContext<
  Args extends unknown[] = unknown[],
  Result = unknown,
  receiver = unknown,
> {
  /** Live call history. `resetCalls()` replaces this array with a fresh one. */
  calls: MockCall<Args, Result>[]
  /**
   * Changes the default implementation without clearing scheduled overrides.
   * @param implementation The replacement implementation.
   */
  mockImplementation(implementation: (this: receiver, ...args: Args) => Result): void
  /**
   * Replaces the implementation for one call, replacing any override at that index.
   * @param implementation The replacement implementation.
   * @param onCall Zero-based call index, which must not have passed (defaults to the next call).
   */
  mockImplementationOnce(
    implementation: (this: receiver, ...args: Args) => Result,
    onCall?: number,
  ): void
  /** Clears call history and resets indices without changing implementations or pending overrides. */
  resetCalls(): void
  /**
   * Counts calls in the live history, including invocations still executing.
   * @returns The length of the current call history.
   */
  callCount(): number
  /**
   * Restores a method's original value and any own descriptor, or a standalone mock's original default.
   * Restoring a method spy skips previously restored spies on the same property.
   * Retains call history and pending overrides; retained method spies remain callable.
   */
  restore(): void
}

/** A function augmented with a `.mock` property for inspecting recorded calls. */
export type MockFunction<T extends (...args: any[]) => any = (...args: any[]) => any> = T & {
  /** Call history and implementation controls for this function. */
  mock: MockContext<Parameters<T>, ReturnType<T>, ThisParameterType<T>>
}

function createMockFn<T extends (...args: any[]) => any>(impl?: T): MockFunction<T> {
  let original = impl
  let implementation:
    | ((this: ThisParameterType<T>, ...args: Parameters<T>) => ReturnType<T>)
    | undefined = impl
  let overrides = new Map<number, NonNullable<typeof implementation>>()

  let fn = function (this: ThisParameterType<T>, ...args: Parameters<T>): ReturnType<T> {
    let index = fn.mock.calls.length
    let current = overrides.get(index) ?? implementation
    overrides.delete(index)
    let call: MockCall<Parameters<T>, ReturnType<T>> = { arguments: args }
    fn.mock.calls.push(call)
    if (current) {
      try {
        let result = current.apply(this, args)
        call.result = result
        return result
      } catch (error) {
        call.error = error
        throw error
      }
    }
    return undefined as ReturnType<T>
  } as MockFunction<T>

  fn.mock = {
    calls: [],
    mockImplementation(value) {
      if (typeof value !== 'function') throw new TypeError('implementation must be a function')
      implementation = value
    },
    mockImplementationOnce(value, onCall) {
      if (typeof value !== 'function') throw new TypeError('implementation must be a function')
      let index = onCall ?? fn.mock.calls.length
      if (typeof index !== 'number') throw new TypeError('onCall must be a number')
      if (!Number.isSafeInteger(index) || index < fn.mock.calls.length) {
        throw new RangeError('onCall must be a safe integer at or after the next call index')
      }
      overrides.set(index, value)
    },
    resetCalls() {
      fn.mock.calls = []
    },
    callCount() {
      return fn.mock.calls.length
    },
    restore() {
      implementation = original
    },
  }
  return fn
}

type Method<target, key extends keyof target> = [
  Extract<target[key], (...args: never[]) => unknown>,
] extends [never]
  ? (...args: any[]) => any
  : Extract<target[key], (...args: never[]) => unknown>

type MethodMock<method extends (...args: any[]) => any> = ((...args: any[]) => any) & {
  mock: Omit<MockFunction['mock'], 'mockImplementation' | 'mockImplementationOnce'> &
    Pick<
      MockContext<Parameters<method>, ReturnType<method>, ThisParameterType<method>>,
      'mockImplementation' | 'mockImplementationOnce'
    >
}

interface MethodRestoration {
  object: object
  method: PropertyKey
  original: unknown
  descriptor: PropertyDescriptor | undefined
  restored: boolean
}

const methodRestorations = new WeakMap<object, MethodRestoration>()

function createMethodMock<T extends object, K extends keyof T>(
  obj: T,
  method: K,
  impl?: T[K] extends (...args: any[]) => any ? (...args: Parameters<T[K]>) => any : never,
): MethodMock<Method<T, K>> {
  let original = obj[method]
  let descriptor = Object.getOwnPropertyDescriptor(obj, method)
  // Initial overrides retain the existing permissive behavior, including absent methods.
  let mockFn = createMockFn((impl ?? original) as Method<T, K>)
  if (!Reflect.set(obj, method, mockFn)) throw new TypeError('Unable to mock the method')
  let restoration: MethodRestoration = {
    object: obj,
    method,
    original,
    descriptor,
    restored: false,
  }
  methodRestorations.set(mockFn, restoration)
  mockFn.mock.restore = () => {
    let target = restoration
    // A nested mock must not reinstall a spy that was manually restored earlier.
    while (typeof target.original === 'function') {
      let previous = methodRestorations.get(target.original)
      if (!previous?.restored || previous.object !== obj || previous.method !== method) break
      target = previous
    }
    if (target.descriptor) {
      Object.defineProperty(obj, method, target.descriptor)
    }
    if (!target.descriptor || !('value' in target.descriptor)) {
      if (!Reflect.set(obj, method, target.original)) {
        throw new TypeError('Unable to restore the method')
      }
    }
    restoration.restored = true
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
 * spy.mock.restore()
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
