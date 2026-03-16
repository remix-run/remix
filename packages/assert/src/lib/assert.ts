export class AssertionError extends Error {
  actual: any
  expected: any
  operator: string

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

export function ok(value: any, message?: string): void {
  if (!value) {
    throw new AssertionError({
      message: message || `Expected ${value} to be truthy`,
      actual: value,
      expected: true,
      operator: '==',
    })
  }
}

export function equal<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new AssertionError({
      message: message || `${actual} !== ${expected}`,
      actual,
      expected,
      operator: 'strictEqual',
    })
  }
}

export function notEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual === expected) {
    throw new AssertionError({
      message: message || `${actual} === ${expected}`,
      actual,
      expected,
      operator: 'notStrictEqual',
    })
  }
}

export function deepEqual<T>(actual: T, expected: T, message?: string): void {
  if (!isDeepEqual(actual, expected)) {
    throw new AssertionError({
      message: message || `Objects not deeply equal`,
      actual,
      expected,
      operator: 'deepStrictEqual',
    })
  }
}

export function notDeepEqual<T>(actual: T, expected: T, message?: string): void {
  if (isDeepEqual(actual, expected)) {
    throw new AssertionError({
      message: message || `Objects are deeply equal`,
      actual,
      expected,
      operator: 'notDeepStrictEqual',
    })
  }
}

export function fail(message?: string): never {
  throw new AssertionError({
    message: message || 'Test failed',
    operator: 'fail',
  })
}

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

export async function rejects(
  fn: () => Promise<any>,
  expectedError?: any,
  message?: string,
): Promise<void> {
  let rejected = false
  let error: any

  try {
    await fn()
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

// assert() is an alias of assert.ok()
export const assert = ok
