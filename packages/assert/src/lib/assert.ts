/**
 * Thrown when an assertion fails. Mirrors the shape of Node.js's built-in
 * `assert.AssertionError` so that test reporters can treat them uniformly.
 */
export class AssertionError extends Error {
  actual: any
  expected: any
  operator: string

  /**
   * Creates a new AssertionError with the given message, actual/expected values, and operator.
   * @param options.message - The error message to display when the assertion fails.
   * @param options.actual - The actual value that was tested.
   * @param options.expected - The expected value that the actual value was compared against.
   * @param options.operator - A string describing the assertion operator (e.g. '==', '===', 'deepEqual').
   */
  constructor(options: { message?: string; actual?: any; expected?: any; operator: string }) {
    super(options.message)
    this.name = 'AssertionError'
    this.actual = options.actual
    this.expected = options.expected
    this.operator = options.operator
  }
}

// Strict deep equality — uses === at primitive leaves (no type coercion).
function isDeepEqual(a: any, b: any): boolean {
  if (a === b) return true
  if (a == null || b == null) return false
  if (typeof a !== typeof b) return false

  if (typeof a === 'object') {
    if (Array.isArray(a) !== Array.isArray(b)) return false

    let keysA = Object.keys(a)
    let keysB = Object.keys(b)

    if (keysA.length !== keysB.length) return false

    return keysA.every((key) => isDeepEqual(a[key], b[key]))
  }

  return false
}

/**
 * Asserts that `value` is truthy. Narrows the type of `value` after the call.
 *
 * @example
 * const cookie = getSessionCookie(response)
 * assert.ok(cookie) // cookie is now `string` (not `string | null`)
 *
 * @param value - The value to test for truthiness.
 * @param message - Optional failure message.
 */
export function ok(value: unknown, message?: string): asserts value {
  if (!value) {
    throw new AssertionError({
      message: message || `Expected ${value} to be truthy`,
      actual: value,
      expected: true,
      operator: '==',
    })
  }
}

/**
 * Asserts strict equality (`===`) between `actual` and `expected`.
 *
 * @example
 * assert.equal(response.status, 200)
 *
 * @param actual - The value produced by the code under test.
 * @param expected - The value to compare against.
 * @param message - Optional failure message.
 */
export function equal<T>(actual: unknown, expected: T, message?: string): asserts actual is T {
  if (actual !== expected) {
    throw new AssertionError({
      message: message || `${actual} !== ${expected}`,
      actual,
      expected,
      operator: 'strictEqual',
    })
  }
}

/**
 * Asserts strict inequality (`!==`) between `actual` and `expected`.
 *
 * @example
 * assert.notEqual(response.status, 404)
 *
 * @param actual - The value produced by the code under test.
 * @param expected - The value that `actual` must not equal.
 * @param message - Optional failure message.
 */
export function notEqual<T>(actual: unknown, expected: unknown, message?: string): void {
  if (actual === expected) {
    throw new AssertionError({
      message: message || `${actual} === ${expected}`,
      actual,
      expected,
      operator: 'notStrictEqual',
    })
  }
}

/**
 * Asserts deep strict equality between `actual` and `expected`. Recursively
 * compares object properties using `===` at primitive leaves (no type coercion).
 *
 * @example
 * assert.deepEqual(result, { id: 1, name: 'Alice' })
 *
 * @param actual - The value produced by the code under test.
 * @param expected - The value to compare against.
 * @param message - Optional failure message.
 */
export function deepEqual<T>(actual: unknown, expected: T, message?: string): asserts actual is T {
  if (!isDeepEqual(actual, expected)) {
    throw new AssertionError({
      message: message || `Objects not deeply equal`,
      actual,
      expected,
      operator: 'deepStrictEqual',
    })
  }
}

/**
 * Asserts that `actual` and `expected` are **not** deeply equal.
 *
 * @example
 * assert.notDeepEqual(result, { id: 1, name: 'Alice' })
 *
 * @param actual - The value produced by the code under test.
 * @param expected - The value that `actual` must not deeply equal.
 * @param message - Optional failure message.
 */
export function notDeepEqual<T>(actual: unknown, expected: unknown, message?: string): void {
  if (isDeepEqual(actual, expected)) {
    throw new AssertionError({
      message: message || `Objects are deeply equal`,
      actual,
      expected,
      operator: 'notDeepStrictEqual',
    })
  }
}

/**
 * Unconditionally fails the test with an optional message.
 *
 * @example
 * assert.fail('this branch should never be reached')
 *
 * @param message - Optional failure message.
 */
export function fail(message?: string): never {
  throw new AssertionError({
    message: message || 'Test failed',
    operator: 'fail',
  })
}

/**
 * Asserts that `string` matches the given `regexp`.
 *
 * @example
 * assert.match(html, /Welcome Back/)
 *
 * @param string - The string to test.
 * @param regexp - The pattern to match against.
 * @param message - Optional failure message.
 */
export function match(string: string, regexp: RegExp, message?: string): void {
  if (!regexp.test(string)) {
    throw new AssertionError({
      message: message || `${string} does not match ${regexp}`,
      actual: string,
      expected: regexp,
      operator: 'match',
    })
  }
}

/**
 * Asserts that `string` does **not** match the given `regexp`.
 *
 * @example
 * assert.doesNotMatch(html, /Error/)
 *
 * @param string - The string to test.
 * @param regexp - The pattern that must not match.
 * @param message - Optional failure message.
 */
export function doesNotMatch(string: string, regexp: RegExp, message?: string): void {
  if (regexp.test(string)) {
    throw new AssertionError({
      message: message || `${string} matches ${regexp}`,
      actual: string,
      expected: regexp,
      operator: 'doesNotMatch',
    })
  }
}

/**
 * Asserts that `fn` throws. Optionally validates the thrown error against
 * `expectedError`, which may be an `Error` constructor, an `Error` instance
 * (matched by message), a `RegExp` (matched against the error message), or a
 * validator function that returns `true` for a valid error.
 *
 * @example
 * assert.throws(() => JSON.parse('invalid'))
 * assert.throws(() => riskyOp(), SyntaxError)
 *
 * @param fn - The function expected to throw.
 * @param expectedError - Optional error constructor, instance, RegExp, or validator.
 * @param message - Optional failure message.
 */
export function throws(fn: () => any, expectedError?: any, message?: string): void {
  let thrown = false
  let error: any

  try {
    fn()
  } catch (e) {
    thrown = true
    error = e
  }

  if (!thrown) {
    throw new AssertionError({
      message: message || 'Expected function to throw',
      operator: 'throws',
    })
  }

  if (expectedError) {
    checkError(error, expectedError, 'throws')
  }
}

/**
 * Asserts that `fn` does **not** throw.
 *
 * @example
 * assert.doesNotThrow(() => JSON.parse('{}'))
 *
 * @param fn - The function expected not to throw.
 * @param message - Optional failure message.
 */
export function doesNotThrow(fn: () => any, message?: string): void {
  try {
    fn()
  } catch (e) {
    throw new AssertionError({
      message: message || `Expected function not to throw, but it threw: ${e}`,
      actual: e,
      expected: undefined,
      operator: 'doesNotThrow',
    })
  }
}

/**
 * Asserts that the promise returned by `fn` (or the promise itself) rejects.
 * Accepts the same `expectedError` shapes as {@link throws}.
 *
 * @example
 * await assert.rejects(fetch('/missing'), (err) => err.status === 404)
 *
 * @param fn - A function returning a promise, or a promise directly.
 * @param expectedError - Optional error constructor, instance, RegExp, or validator.
 * @param message - Optional failure message.
 */
export async function rejects(
  fn: (() => Promise<any>) | Promise<any>,
  expectedError?: any,
  message?: string,
): Promise<void> {
  let rejected = false
  let error: any

  try {
    await (typeof fn === 'function' ? fn() : fn)
  } catch (e) {
    rejected = true
    error = e
  }

  if (!rejected) {
    throw new AssertionError({
      message: message || 'Expected promise to reject',
      operator: 'rejects',
    })
  }

  if (expectedError) {
    checkError(error, expectedError, 'rejects')
  }
}

/**
 * Asserts that the promise returned by `fn` does **not** reject.
 *
 * @example
 * await assert.doesNotReject(() => fetch('/healthy'))
 *
 * @param fn - A function returning a promise.
 * @param message - Optional failure message.
 */
export async function doesNotReject(fn: () => Promise<any>, message?: string): Promise<void> {
  try {
    await fn()
  } catch (e) {
    throw new AssertionError({
      message: message || `Expected promise not to reject, but it rejected with: ${e}`,
      actual: e,
      expected: undefined,
      operator: 'doesNotReject',
    })
  }
}

function isErrorConstructor(fn: Function): boolean {
  return fn.prototype != null && fn.prototype instanceof Error
}

function checkError(error: any, expectedError: any, operator: string): void {
  if (typeof expectedError === 'function') {
    if (isErrorConstructor(expectedError)) {
      if (!(error instanceof expectedError)) {
        throw new AssertionError({
          message: `Expected error to be instance of ${expectedError.name}`,
          actual: error,
          expected: expectedError,
          operator,
        })
      }
    } else {
      // Validator function (arrow function or plain function returning boolean)
      if (!expectedError(error)) {
        throw new AssertionError({
          message: `Error did not pass validation function`,
          actual: error,
          expected: expectedError,
          operator,
        })
      }
    }
  } else if (expectedError instanceof Error) {
    if (error.message !== expectedError.message) {
      throw new AssertionError({
        message: `Error message doesn't match`,
        actual: error.message,
        expected: expectedError.message,
        operator,
      })
    }
  } else if (expectedError instanceof RegExp) {
    if (!expectedError.test(error.message)) {
      throw new AssertionError({
        message: `Error message doesn't match pattern`,
        actual: error.message,
        expected: expectedError,
        operator,
      })
    }
  }
}

/** Alias for {@link ok}. */
export const assert = ok
