import { isDeepEqual, isPartialDeepEqual } from './deep-equal.ts'

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
    message?: unknown
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

type ErrorWithCode = Error & { code: string }

interface AssertionOptions {
  message?: unknown
  actual?: unknown
  expected?: unknown
  operator: string
  generatedMessage?: boolean
}

function getGeneratedMessage(actual: unknown, expected: unknown, operator: string): string {
  if (operator === 'fail') return 'Failed'
  return `${stringify(actual)} ${operator} ${stringify(expected)}`
}

function getAssertionMessage(message: unknown, generatedMessage: string): unknown {
  return message == null ? generatedMessage : message
}

function getComparisonAssertionMessage(message: unknown, generatedMessage: string): unknown {
  if (message instanceof Error) return message
  if (typeof message === 'string' && message.length > 0) return message
  return generatedMessage
}

function isGeneratedComparisonMessage(message: unknown): boolean {
  return !(message instanceof Error) && (typeof message !== 'string' || message.length === 0)
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

function stringifyReceived(value: unknown): string {
  if (typeof value === 'string') return `'${value}'`
  return stringify(value)
}

function formatReceived(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'object') {
    let name = value?.constructor?.name
    return name === undefined ? 'an object' : `an instance of ${name}`
  }

  return `type ${typeof value} (${stringifyReceived(value)})`
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
    return String(message)
  }

  return 'undefined'
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

function parseExpectedDoesNotError(
  expectedErrorOrMessage: unknown,
  message: AssertionMessage | undefined,
): { expectedError: unknown; message: AssertionMessage | undefined } {
  if (typeof expectedErrorOrMessage === 'string') {
    return { expectedError: undefined, message: expectedErrorOrMessage }
  }

  return { expectedError: expectedErrorOrMessage, message }
}

function validateExpectedError(expectedError: unknown): void {
  if (
    expectedError == null ||
    typeof expectedError === 'function' ||
    expectedError instanceof Error ||
    expectedError instanceof RegExp ||
    typeof expectedError === 'object'
  ) {
    return
  }

  throw createInvalidArgumentTypeError(
    'error',
    'of type function or an instance of Error, RegExp, or Object',
    expectedError,
  )
}

function validateExpectedDoesNotError(expectedError: unknown): void {
  if (
    expectedError == null ||
    typeof expectedError === 'function' ||
    expectedError instanceof RegExp
  ) {
    return
  }

  throw createInvalidArgumentTypeError(
    'expected',
    'of type function or an instance of RegExp',
    expectedError,
  )
}

function validateExpectedObject(expectedError: object): void {
  if (Object.keys(expectedError).length === 0) {
    throw createInvalidArgumentValueError(
      'error',
      `may not be an empty object. Received ${stringify(expectedError)}`,
    )
  }
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
  let base =
    message === undefined ? `Got unwanted ${noun}.` : appendMessage(`Got unwanted ${noun}`, message)
  return `${base}\nActual message: "${getErrorMessage(error)}"`
}

function createNodeTypeError(code: string, message: string): ErrorWithCode {
  let error = new TypeError(message) as ErrorWithCode
  error.code = code
  return error
}

function createInvalidArgumentTypeError(
  argumentName: string,
  expectedDescription: string,
  actualValue: unknown,
): ErrorWithCode {
  return createNodeTypeError(
    'ERR_INVALID_ARG_TYPE',
    `The "${argumentName}" argument must be ${expectedDescription}. Received ${formatReceived(actualValue)}`,
  )
}

function createInvalidArgumentValueError(argumentName: string, message: string): ErrorWithCode {
  return createNodeTypeError('ERR_INVALID_ARG_VALUE', `The argument '${argumentName}' ${message}`)
}

function validateFunction(value: unknown, argumentName: string): asserts value is () => unknown {
  if (typeof value !== 'function') {
    throw createInvalidArgumentTypeError(argumentName, 'of type function', value)
  }
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
      message: getAssertionMessage(message, `Expected ${stringify(value)} to be truthy`),
      actual: value,
      expected: true,
      operator: '==',
      generatedMessage: message == null,
    })
  }
}

/**
 * Asserts strict equality (`Object.is`) between `actual` and `expected`.
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
  if (!Object.is(actual, expected)) {
    throwAssertion({
      message: getComparisonAssertionMessage(
        message,
        `${stringify(actual)} !== ${stringify(expected)}`,
      ),
      actual,
      expected,
      operator: 'strictEqual',
      generatedMessage: isGeneratedComparisonMessage(message),
    })
  }
}

/**
 * Asserts strict inequality (`!Object.is`) between `actual` and `expected`.
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
  if (Object.is(actual, expected)) {
    throwAssertion({
      message: getComparisonAssertionMessage(
        message,
        `${stringify(actual)} === ${stringify(expected)}`,
      ),
      actual,
      expected,
      operator: 'notStrictEqual',
      generatedMessage: isGeneratedComparisonMessage(message),
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
      message: getComparisonAssertionMessage(message, `Objects not deeply equal`),
      actual,
      expected,
      operator: 'deepStrictEqual',
      generatedMessage: isGeneratedComparisonMessage(message),
    })
  }
}

/**
 * Asserts that `actual` contains the partial deep structure in `expected`.
 *
 * @example
 * assert.partialDeepEqual(result, { id: 1 })
 *
 * @param actual - The value produced by the code under test.
 * @param expected - The partial structure that must be present in `actual`.
 * @param message - Optional failure message.
 */
export function partialDeepEqual(
  actual: unknown,
  expected: unknown,
  message?: AssertionMessage,
): void {
  if (!isPartialDeepEqual(actual, expected)) {
    throwAssertion({
      message: getComparisonAssertionMessage(message, `Objects not partially deeply equal`),
      actual,
      expected,
      operator: 'partialDeepStrictEqual',
      generatedMessage: isGeneratedComparisonMessage(message),
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
      message: getComparisonAssertionMessage(message, `Objects are deeply equal`),
      actual,
      expected,
      operator: 'notDeepStrictEqual',
      generatedMessage: isGeneratedComparisonMessage(message),
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
    message: message == null ? 'Failed' : message,
    operator: 'fail',
    generatedMessage: isGeneratedComparisonMessage(message),
  })
}

/**
 * Throws when `value` is not `null` or `undefined`.
 *
 * @example
 * assert.ifError(callbackError)
 *
 * @param value - The error-like value to check.
 */
export function ifError(value: unknown): asserts value is null | undefined {
  if (value !== null && value !== undefined) {
    throwAssertion(
      {
        message: `ifError got unwanted exception: ${stringify(value)}`,
        actual: value,
        expected: null,
        operator: 'ifError',
        generatedMessage: false,
      },
      false,
    )
  }
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
  checkMatchArguments(string, regexp, 'match')

  if (!regexp.test(string)) {
    throwAssertion({
      message: getComparisonAssertionMessage(
        message,
        `${stringify(string)} does not match ${regexp}`,
      ),
      actual: string,
      expected: regexp,
      operator: 'match',
      generatedMessage: isGeneratedComparisonMessage(message),
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
  checkMatchArguments(string, regexp, 'doesNotMatch')

  if (regexp.test(string)) {
    throwAssertion({
      message: getComparisonAssertionMessage(message, `${stringify(string)} matches ${regexp}`),
      actual: string,
      expected: regexp,
      operator: 'doesNotMatch',
      generatedMessage: isGeneratedComparisonMessage(message),
    })
  }
}

function checkMatchArguments(
  string: unknown,
  regexp: unknown,
  operator: 'match' | 'doesNotMatch',
): asserts string is string {
  if (!(regexp instanceof RegExp)) {
    throw createInvalidArgumentTypeError('regexp', 'an instance of RegExp', regexp)
  }

  if (typeof string !== 'string') {
    throwAssertion(
      {
        message: `The "string" argument must be of type string. Received type ${typeof string} (${stringify(
          string,
        )})`,
        actual: string,
        expected: regexp,
        operator,
        generatedMessage: true,
      },
      false,
    )
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
  validateFunction(fn, 'fn')

  let { expectedError, message: failureMessage } = parseExpectedError(
    expectedErrorOrMessage,
    message,
  )
  validateExpectedError(expectedError)
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
  validateFunction(fn, 'fn')

  let { expectedError, message: failureMessage } = parseExpectedDoesNotError(
    expectedErrorOrMessage,
    message,
  )

  try {
    fn()
  } catch (e) {
    validateExpectedDoesNotError(expectedError)

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
      throw createNodeTypeError(
        'ERR_INVALID_RETURN_VALUE',
        `Expected instance of Promise to be returned from the "promiseFn" function but got type ${typeof promise} (${stringify(
          promise,
        )}).`,
      )
    }

    return promise
  }

  if (!(value instanceof Promise)) {
    throw createInvalidArgumentTypeError(
      'promiseFn',
      'of type function or an instance of Promise',
      value,
    )
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
  validateExpectedError(expectedError)
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
  let { expectedError, message: failureMessage } = parseExpectedDoesNotError(
    expectedErrorOrMessage,
    message,
  )
  let promise = getPromise(fn)

  try {
    await promise
  } catch (e) {
    validateExpectedDoesNotError(expectedError)

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

function isInstanceOf(error: unknown, fn: Function): boolean {
  try {
    return error instanceof fn
  } catch {
    return false
  }
}

function isErrorConstructor(fn: Function): boolean {
  return fn === Error || (fn.prototype != null && fn.prototype instanceof Error)
}

function errorMatches(error: unknown, expectedError: unknown): boolean {
  if (typeof expectedError === 'function') {
    if (isInstanceOf(error, expectedError)) {
      return true
    }

    if (isErrorConstructor(expectedError)) {
      return false
    }

    return expectedError(error) === true
  }

  if (expectedError instanceof Error) {
    return isDeepEqual(error, expectedError)
  }

  if (expectedError instanceof RegExp) {
    return expectedError.test(String(error))
  }

  if (expectedError !== null && typeof expectedError === 'object') {
    let expectedRecord = expectedError as Record<string, unknown>
    validateExpectedObject(expectedRecord)
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
    if (isInstanceOf(error, expectedError)) {
      return
    }

    if (isErrorConstructor(expectedError)) {
      throwAssertion(
        {
          message:
            formatMessage(message) ?? `Expected error to be instance of ${expectedError.name}`,
          actual: error,
          expected: expectedError,
          operator,
          generatedMessage: message == null,
        },
        false,
      )
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
            generatedMessage: message == null,
          },
          false,
        )
      }
    }
  } else if (expectedError instanceof Error) {
    if (!isDeepEqual(error, expectedError)) {
      throwAssertion(
        {
          message: formatMessage(message) ?? `Error doesn't match expected error`,
          actual: error,
          expected: expectedError,
          operator,
          generatedMessage: message == null,
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
          generatedMessage: message == null,
        },
        false,
      )
    }
  } else if (expectedError !== null && typeof expectedError === 'object') {
    // Validate each property on the expected object against the error.
    // RegExp values match string properties; everything else uses deep equality.
    let expectedRecord = expectedError as Record<string, unknown>
    validateExpectedObject(expectedRecord)
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
            generatedMessage: message == null,
          },
          false,
        )
      }
    }
  }
}

/** Alias for {@link ok}. */
export const assert = ok
