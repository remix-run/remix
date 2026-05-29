/**
 * Thrown when an assertion fails. Mirrors the shape of Node.js's built-in
 * `assert.AssertionError` so that test reporters can treat them uniformly.
 */
export class AssertionError extends Error {
  actual: unknown
  expected: unknown
  operator: string
  generatedMessage: boolean
  code = 'ERR_ASSERTION'

  /**
   * Creates a new AssertionError with the given message, actual/expected values, and operator.
   * @param options.message - The error message to display when the assertion fails.
   * @param options.actual - The actual value that was tested.
   * @param options.expected - The expected value that the actual value was compared against.
   * @param options.operator - A string describing the assertion operator (e.g. '==', '===', 'deepEqual').
   */
  constructor(options: {
    message?: string | Error
    actual?: unknown
    expected?: unknown
    operator: string
    generatedMessage?: boolean
  }) {
    let generatedMessage = options.generatedMessage ?? options.message == null
    let message =
      options.message == null
        ? getGeneratedMessage(options.actual, options.expected, options.operator)
        : String(options.message)

    super(message)
    this.name = 'AssertionError'
    this.actual = options.actual
    this.expected = options.expected
    this.operator = options.operator
    this.generatedMessage = generatedMessage
  }
}

type AssertionMessage = string | Error

interface AssertionOptions {
  message?: AssertionMessage
  actual?: unknown
  expected?: unknown
  operator: string
  generatedMessage?: boolean
}

function getGeneratedMessage(actual: unknown, expected: unknown, operator: string): string {
  if (operator === 'fail') return 'Failed'
  return `${stringify(actual)} ${operator} ${stringify(expected)}`
}

function throwAssertion(options: AssertionOptions, directErrorMessage = true): never {
  if (directErrorMessage && options.message instanceof Error) {
    throw options.message
  }

  throw new AssertionError(options)
}

function stringify(value: unknown): string {
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'function') return `[Function${value.name ? ': ' + value.name : ''}]`
  if (value instanceof Error) return `${value.name}: ${value.message}`

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function formatMessage(message: AssertionMessage | undefined): string | undefined {
  return message === undefined ? undefined : String(message)
}

function appendMessage(base: string, message: AssertionMessage | undefined): string {
  let messageText = formatMessage(message)
  return messageText === undefined ? base : `${base}: ${messageText}`
}

function getErrorMessage(error: unknown): string {
  if (error != null && typeof error === 'object' && 'message' in error) {
    let message = (error as { message?: unknown }).message
    if (typeof message === 'string') return message
  }

  return String(error)
}

function getExpectedErrorName(expectedError: unknown): string | undefined {
  if (typeof expectedError === 'function') {
    return expectedError.name || undefined
  }

  if (expectedError instanceof Error) {
    return expectedError.name
  }

  return undefined
}

function parseExpectedError(
  expectedErrorOrMessage: unknown,
  message: AssertionMessage | undefined,
): { expectedError: unknown; message: AssertionMessage | undefined } {
  if (typeof expectedErrorOrMessage === 'string' && message === undefined) {
    return { expectedError: undefined, message: expectedErrorOrMessage }
  }

  return { expectedError: expectedErrorOrMessage, message }
}

function getMissingExceptionMessage(
  operator: 'throws' | 'rejects',
  expectedError: unknown,
  message: AssertionMessage | undefined,
): string {
  let expectedName = getExpectedErrorName(expectedError)
  let kind = operator === 'throws' ? 'exception' : 'rejection'
  let base =
    expectedName === undefined
      ? `Missing expected ${kind}`
      : `Missing expected ${kind} (${expectedName})`

  return message === undefined ? `${base}.` : appendMessage(base, message)
}

function getUnwantedExceptionMessage(
  operator: 'doesNotThrow' | 'doesNotReject',
  error: unknown,
  message: AssertionMessage | undefined,
): string {
  let noun = operator === 'doesNotThrow' ? 'exception' : 'rejection'
  let base = appendMessage(`Got unwanted ${noun}`, message)
  return `${base}\nActual message: "${getErrorMessage(error)}"`
}

// Strict deep equality — uses === at primitive leaves (no type coercion).
function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function isDeepEqual(a: any, b: any): boolean {
  if (a === b) return true
  if (a == null || b == null) return false
  if (typeof a !== typeof b) return false

  if (typeof a === 'object') {
    if (Array.isArray(a) !== Array.isArray(b)) return false

    let keysA = Object.keys(a)
    let keysB = Object.keys(b)

    if (keysA.length !== keysB.length) return false

    return keysA.every((key) => hasOwn(b, key) && isDeepEqual(a[key], b[key]))
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
export function ok(value: unknown, message?: AssertionMessage): asserts value {
  if (!value) {
    throwAssertion({
      message: message ?? `Expected ${stringify(value)} to be truthy`,
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
export function equal<T>(
  actual: unknown,
  expected: T,
  message?: AssertionMessage,
): asserts actual is T {
  if (actual !== expected) {
    throwAssertion({
      message: message ?? `${stringify(actual)} !== ${stringify(expected)}`,
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
export function notEqual<_value>(
  actual: unknown,
  expected: unknown,
  message?: AssertionMessage,
): void {
  if (actual === expected) {
    throwAssertion({
      message: message ?? `${stringify(actual)} === ${stringify(expected)}`,
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
export function deepEqual<T>(
  actual: unknown,
  expected: T,
  message?: AssertionMessage,
): asserts actual is T {
  if (!isDeepEqual(actual, expected)) {
    throwAssertion({
      message: message ?? `Objects not deeply equal`,
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
export function notDeepEqual<_value>(
  actual: unknown,
  expected: unknown,
  message?: AssertionMessage,
): void {
  if (isDeepEqual(actual, expected)) {
    throwAssertion({
      message: message ?? `Objects are deeply equal`,
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
export function fail(message?: AssertionMessage): never {
  throwAssertion({
    message: message ?? 'Failed',
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
export function match(string: string, regexp: RegExp, message?: AssertionMessage): void {
  if (!regexp.test(string)) {
    throwAssertion({
      message: message ?? `${stringify(string)} does not match ${regexp}`,
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
export function doesNotMatch(string: string, regexp: RegExp, message?: AssertionMessage): void {
  if (regexp.test(string)) {
    throwAssertion({
      message: message ?? `${stringify(string)} matches ${regexp}`,
      actual: string,
      expected: regexp,
      operator: 'doesNotMatch',
    })
  }
}

/**
 * Asserts that `fn` throws. Optionally validates the thrown error against
 * `expectedError`, which may be an `Error` constructor, an `Error` instance
 * (matched by message), a `RegExp` (matched against the error message), a
 * plain object (each property checked against the error, with `RegExp` values
 * matching string properties), or a validator function that returns `true`
 * for a valid error.
 *
 * @example
 * assert.throws(() => JSON.parse('invalid'))
 * assert.throws(() => riskyOp(), SyntaxError)
 * assert.throws(() => riskyOp(), { code: 'ERR_INVALID_ARG_VALUE' })
 *
 * @param fn - The function expected to throw.
 * @param expectedErrorOrMessage - Optional error constructor, instance, RegExp, object, validator, or failure message.
 * @param message - Optional failure message when `expectedErrorOrMessage` is an error matcher.
 */
export function throws(
  fn: () => unknown,
  expectedErrorOrMessage?: unknown,
  message?: AssertionMessage,
): void {
  let { expectedError, message: failureMessage } = parseExpectedError(
    expectedErrorOrMessage,
    message,
  )
  let thrown = false
  let error: unknown

  try {
    fn()
  } catch (e) {
    thrown = true
    error = e
  }

  if (!thrown) {
    throwAssertion(
      {
        message: getMissingExceptionMessage('throws', expectedError, failureMessage),
        expected: expectedError,
        operator: 'throws',
        generatedMessage: false,
      },
      false,
    )
  }

  if (expectedError !== undefined) {
    checkError(error, expectedError, 'throws', failureMessage)
  }
}

/**
 * Asserts that `fn` does **not** throw.
 *
 * @example
 * assert.doesNotThrow(() => JSON.parse('{}'))
 *
 * @param fn - The function expected not to throw.
 * @param expectedErrorOrMessage - Optional error constructor, instance, RegExp, object, validator, or failure message.
 * @param message - Optional failure message when `expectedErrorOrMessage` is an error matcher.
 */
export function doesNotThrow(
  fn: () => unknown,
  expectedErrorOrMessage?: unknown,
  message?: AssertionMessage,
): void {
  let { expectedError, message: failureMessage } = parseExpectedError(
    expectedErrorOrMessage,
    message,
  )

  try {
    fn()
  } catch (e) {
    if (expectedError === undefined || errorMatches(e, expectedError)) {
      throwAssertion(
        {
          message: getUnwantedExceptionMessage('doesNotThrow', e, failureMessage),
          actual: e,
          expected: expectedError,
          operator: 'doesNotThrow',
          generatedMessage: false,
        },
        false,
      )
    }

    throw e
  }
}

function getPromise(value: (() => Promise<unknown>) | Promise<unknown>): Promise<unknown> {
  if (typeof value === 'function') {
    let promise = value()

    if (!(promise instanceof Promise)) {
      throw new TypeError(
        `Expected instance of Promise to be returned from the "promiseFn" function but got ${typeof promise} (${stringify(
          promise,
        )}).`,
      )
    }

    return promise
  }

  return value
}

/**
 * Asserts that the promise returned by `fn` (or the promise itself) rejects.
 * Accepts the same `expectedError` shapes as {@link throws}.
 *
 * @example
 * await assert.rejects(fetch('/missing'), (err) => err.status === 404)
 * await assert.rejects(fetch('/missing'), { code: 'ERR_INVALID_ARG_VALUE' })
 *
 * @param fn - A function returning a promise, or a promise directly.
 * @param expectedErrorOrMessage - Optional error constructor, instance, RegExp, object, validator, or failure message.
 * @param message - Optional failure message when `expectedErrorOrMessage` is an error matcher.
 */
export async function rejects(
  fn: (() => Promise<unknown>) | Promise<unknown>,
  expectedErrorOrMessage?: unknown,
  message?: AssertionMessage,
): Promise<void> {
  let { expectedError, message: failureMessage } = parseExpectedError(
    expectedErrorOrMessage,
    message,
  )
  let rejected = false
  let error: unknown
  let promise = getPromise(fn)

  try {
    await promise
  } catch (e) {
    rejected = true
    error = e
  }

  if (!rejected) {
    throwAssertion(
      {
        message: getMissingExceptionMessage('rejects', expectedError, failureMessage),
        expected: expectedError,
        operator: 'rejects',
        generatedMessage: false,
      },
      false,
    )
  }

  if (expectedError !== undefined) {
    checkError(error, expectedError, 'rejects', failureMessage)
  }
}

/**
 * Asserts that the promise returned by `fn` does **not** reject.
 *
 * @example
 * await assert.doesNotReject(() => fetch('/healthy'))
 *
 * @param fn - A function returning a promise.
 * @param expectedErrorOrMessage - Optional error constructor, instance, RegExp, object, validator, or failure message.
 * @param message - Optional failure message when `expectedErrorOrMessage` is an error matcher.
 */
export async function doesNotReject(
  fn: (() => Promise<unknown>) | Promise<unknown>,
  expectedErrorOrMessage?: unknown,
  message?: AssertionMessage,
): Promise<void> {
  let { expectedError, message: failureMessage } = parseExpectedError(
    expectedErrorOrMessage,
    message,
  )
  let promise = getPromise(fn)

  try {
    await promise
  } catch (e) {
    if (expectedError === undefined || errorMatches(e, expectedError)) {
      throwAssertion(
        {
          message: getUnwantedExceptionMessage('doesNotReject', e, failureMessage),
          actual: e,
          expected: expectedError,
          operator: 'doesNotReject',
          generatedMessage: false,
        },
        false,
      )
    }

    throw e
  }
}

function isErrorConstructor(fn: Function): boolean {
  return fn.prototype != null && fn.prototype instanceof Error
}

function errorMatches(error: unknown, expectedError: unknown): boolean {
  if (typeof expectedError === 'function') {
    if (isErrorConstructor(expectedError)) {
      return error instanceof expectedError
    }

    return expectedError(error) === true
  }

  if (expectedError instanceof Error) {
    return (
      error instanceof Error &&
      error.name === expectedError.name &&
      error.message === expectedError.message
    )
  }

  if (expectedError instanceof RegExp) {
    return expectedError.test(String(error))
  }

  if (expectedError !== null && typeof expectedError === 'object') {
    let expectedRecord = expectedError as Record<string, unknown>
    return Object.keys(expectedRecord).every((key) => {
      let expectedValue = expectedRecord[key]
      let actualValue = error == null ? undefined : (error as Record<string, unknown>)[key]
      return expectedValue instanceof RegExp
        ? typeof actualValue === 'string' && expectedValue.test(actualValue)
        : isDeepEqual(actualValue, expectedValue)
    })
  }

  return true
}

function checkError(
  error: unknown,
  expectedError: unknown,
  operator: string,
  message: AssertionMessage | undefined,
): void {
  if (typeof expectedError === 'function') {
    if (isErrorConstructor(expectedError)) {
      if (!(error instanceof expectedError)) {
        throwAssertion(
          {
            message:
              formatMessage(message) ?? `Expected error to be instance of ${expectedError.name}`,
            actual: error,
            expected: expectedError,
            operator,
            generatedMessage: message === undefined,
          },
          false,
        )
      }
    } else {
      let result = expectedError(error)
      // Validator functions must return true specifically, matching Node's
      // assertion contract. Truthy non-boolean values are assertion failures.
      if (result !== true) {
        throwAssertion(
          {
            message:
              formatMessage(message) ??
              `The validation function is expected to return "true". Received ${stringify(
                result,
              )}\n\nCaught error:\n\n${String(error)}`,
            actual: error,
            expected: expectedError,
            operator,
            generatedMessage: message === undefined,
          },
          false,
        )
      }
    }
  } else if (expectedError instanceof Error) {
    if (!errorMatches(error, expectedError)) {
      throwAssertion(
        {
          message: formatMessage(message) ?? `Error doesn't match expected error`,
          actual: error,
          expected: expectedError,
          operator,
          generatedMessage: message === undefined,
        },
        false,
      )
    }
  } else if (expectedError instanceof RegExp) {
    if (!expectedError.test(String(error))) {
      throwAssertion(
        {
          message: formatMessage(message) ?? `Error message doesn't match pattern`,
          actual: error,
          expected: expectedError,
          operator,
          generatedMessage: message === undefined,
        },
        false,
      )
    }
  } else if (expectedError !== null && typeof expectedError === 'object') {
    // Validate each property on the expected object against the error.
    // RegExp values match string properties; everything else uses deep equality.
    let expectedRecord = expectedError as Record<string, unknown>
    for (let key of Object.keys(expectedRecord)) {
      let expectedValue = expectedRecord[key]
      let actualValue = error == null ? undefined : (error as Record<string, unknown>)[key]
      let matches =
        expectedValue instanceof RegExp
          ? typeof actualValue === 'string' && expectedValue.test(actualValue)
          : isDeepEqual(actualValue, expectedValue)
      if (!matches) {
        throwAssertion(
          {
            message: formatMessage(message) ?? `Error property "${key}" doesn't match`,
            actual: error,
            expected: expectedError,
            operator,
            generatedMessage: message === undefined,
          },
          false,
        )
      }
    }
  }
}

/** Alias for {@link ok}. */
export const assert = ok
