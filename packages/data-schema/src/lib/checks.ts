import type { Check } from './schema.ts'

/**
 * Require a string to be at least `length` characters long.
 *
 * @param length The minimum number of characters
 * @returns A `Check` that enforces the minimum length
 */
export function minLength(length: number): Check<string> {
  return {
    check(value) {
      return value.length >= length
    },
    code: 'string.min_length',
    values: { min: length },
    message: 'Expected at least ' + String(length) + ' characters',
  }
}

/**
 * Require a string to be at most `length` characters long.
 *
 * @param length The maximum number of characters
 * @returns A `Check` that enforces the maximum length
 */
export function maxLength(length: number): Check<string> {
  return {
    check(value) {
      return value.length <= length
    },
    code: 'string.max_length',
    values: { max: length },
    message: 'Expected at most ' + String(length) + ' characters',
  }
}

/**
 * Require a string to be a valid email address.
 *
 * @returns A `Check` that validates email-like strings
 */
export function email(): Check<string> {
  return {
    check(value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    },
    code: 'string.email',
    message: 'Expected valid email',
  }
}

/**
 * Require a string to be a valid URL.
 *
 * @returns A `Check` that validates URL-like strings
 */
export function url(): Check<string> {
  return {
    check(value) {
      try {
        new URL(value)
        return true
      } catch {
        return false
      }
    },
    code: 'string.url',
    message: 'Expected valid URL',
  }
}

/**
 * Require a number to be greater than or equal to `limit`.
 *
 * @param limit The inclusive minimum value
 * @returns A `Check` that enforces the lower bound
 */
export function min(limit: number): Check<number> {
  return {
    check(value) {
      return value >= limit
    },
    code: 'number.min',
    values: { min: limit },
    message: 'Expected number greater than or equal to ' + String(limit),
  }
}

/**
 * Require a number to be less than or equal to `limit`.
 *
 * @param limit The inclusive maximum value
 * @returns A `Check` that enforces the upper bound
 */
export function max(limit: number): Check<number> {
  return {
    check(value) {
      return value <= limit
    },
    code: 'number.max',
    values: { max: limit },
    message: 'Expected number less than or equal to ' + String(limit),
  }
}
