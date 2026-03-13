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

export let assert = {
  ok(value: any, message?: string) {
    if (!value) {
      throw new AssertionError({
        message: message || `Expected ${value} to be truthy`,
        actual: value,
        expected: true,
        operator: '==',
      })
    }
  },

  equal<T>(actual: T, expected: T, message?: string) {
    if (actual !== expected) {
      throw new AssertionError({
        message: message || `${actual} !== ${expected}`,
        actual,
        expected,
        operator: 'strictEqual',
      })
    }
  },

  notEqual<T>(actual: T, expected: T, message?: string) {
    if (actual === expected) {
      throw new AssertionError({
        message: message || `${actual} === ${expected}`,
        actual,
        expected,
        operator: 'notStrictEqual',
      })
    }
  },

  deepEqual<T>(actual: T, expected: T, message?: string) {
    if (!isDeepEqual(actual, expected)) {
      throw new AssertionError({
        message: message || `Objects not deeply equal`,
        actual,
        expected,
        operator: 'deepStrictEqual',
      })
    }
  },

  notDeepEqual<T>(actual: T, expected: T, message?: string) {
    if (isDeepEqual(actual, expected)) {
      throw new AssertionError({
        message: message || `Objects are deeply equal`,
        actual,
        expected,
        operator: 'notDeepStrictEqual',
      })
    }
  },

  fail(message?: string) {
    throw new AssertionError({
      message: message || 'Test failed',
      operator: 'fail',
    })
  },

  match(string: string, regexp: RegExp, message?: string) {
    if (!regexp.test(string)) {
      throw new AssertionError({
        message: message || `${string} does not match ${regexp}`,
        actual: string,
        expected: regexp,
        operator: 'match',
      })
    }
  },

  throws(fn: () => any, expectedError?: any, message?: string) {
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
      if (typeof expectedError === 'function') {
        if (!(error instanceof expectedError)) {
          throw new AssertionError({
            message: `Expected error to be instance of ${expectedError.name}`,
            actual: error,
            expected: expectedError,
            operator: 'throws',
          })
        }
      } else if (expectedError instanceof RegExp) {
        if (!expectedError.test(error.message)) {
          throw new AssertionError({
            message: `Error message doesn't match pattern`,
            actual: error.message,
            expected: expectedError,
            operator: 'throws',
          })
        }
      }
    }
  },

  async rejects(fn: () => Promise<any>, expectedError?: any, message?: string) {
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
      if (typeof expectedError === 'function') {
        if (!(error instanceof expectedError)) {
          throw new AssertionError({
            message: `Expected error to be instance of ${expectedError.name}`,
            actual: error,
            expected: expectedError,
            operator: 'rejects',
          })
        }
      } else if (expectedError instanceof RegExp) {
        if (!expectedError.test(error.message)) {
          throw new AssertionError({
            message: `Error message doesn't match pattern`,
            actual: error.message,
            expected: expectedError,
            operator: 'rejects',
          })
        }
      }
    }
  },
}

export const { ok, equal, notEqual, deepEqual, notDeepEqual, fail, match, throws, rejects } = assert
