import { AssertionError } from './assert.ts'

// Sentinel used by `expect.objectContaining(...)` so `toEqual` can recognize
// an asymmetric (partial) match instead of a full deep equality check.
const PARTIAL_MATCHER = Symbol.for('@remix-run/assert/partialMatcher')

interface PartialMatcher {
  [PARTIAL_MATCHER]: true
  expected: object
}

function isPartialMatcher(value: unknown): value is PartialMatcher {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<symbol, unknown>)[PARTIAL_MATCHER] === true
  )
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

// Strict deep equality — uses === at primitive leaves (no type coercion).
// `b` may be a partial matcher (from `expect.objectContaining`), in which case
// only the keys it specifies are required to match.
function isDeepEqual(a: any, b: any): boolean {
  if (isPartialMatcher(b)) return matchesPartial(a, b.expected)
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

// Recursive partial match: every key in `expected` must match in `actual`,
// but `actual` is allowed to have additional keys. Used by both
// `expect.objectContaining` and `toMatchObject`.
function matchesPartial(actual: any, expected: any): boolean {
  if (actual === expected) return true
  if (actual == null || expected == null) return false
  if (typeof expected !== 'object') return Object.is(actual, expected)
  if (typeof actual !== 'object') return false

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return false
    if (actual.length !== expected.length) return false
    return expected.every((value, index) => matchesPartial(actual[index], value))
  }

  return Object.keys(expected).every(
    (key) => hasOwn(actual, key) && matchesPartial(actual[key], expected[key]),
  )
}

interface MockShape {
  mock: {
    calls: Array<{ arguments: unknown[] }>
  }
}

function isMockFn(value: unknown): value is MockShape {
  return (
    typeof value === 'function' &&
    typeof (value as any).mock === 'object' &&
    (value as any).mock != null &&
    Array.isArray((value as any).mock.calls)
  )
}

function getMockCalls(received: unknown, matcherName: string): Array<{ arguments: unknown[] }> {
  if (!isMockFn(received)) {
    throw new AssertionError({
      message: `${matcherName} requires a mock function with a .mock.calls property`,
      operator: matcherName,
    })
  }
  return received.mock.calls
}

function checkErrorMatch(error: any, expected: unknown): boolean {
  if (expected === undefined) return true
  if (typeof expected === 'function') {
    if (expected.prototype != null && expected.prototype instanceof Error) {
      return error instanceof (expected as new (...args: any[]) => Error)
    }
    return Boolean((expected as (e: unknown) => unknown)(error))
  }
  if (expected instanceof Error) {
    return error?.message === expected.message
  }
  if (expected instanceof RegExp) {
    return expected.test(error?.message ?? String(error))
  }
  if (typeof expected === 'string') {
    return typeof error?.message === 'string' && error.message.includes(expected)
  }
  return false
}

function describeExpectedError(expected: unknown): string {
  if (expected === undefined) return 'an error'
  if (typeof expected === 'function') {
    if (expected.prototype != null && expected.prototype instanceof Error) {
      return `an instance of ${(expected as Function).name}`
    }
    return 'an error matching the validator'
  }
  if (expected instanceof Error) return `an error with message ${JSON.stringify(expected.message)}`
  if (expected instanceof RegExp) return `an error matching ${expected}`
  if (typeof expected === 'string') return `an error containing ${JSON.stringify(expected)}`
  return String(expected)
}

interface Matchers {
  toBe(expected: unknown): void
  toEqual(expected: unknown): void
  toBeNull(): void
  toBeUndefined(): void
  toBeDefined(): void
  toBeTruthy(): void
  toBeInstanceOf(ctor: Function): void
  toBeGreaterThan(n: number): void
  toBeGreaterThanOrEqual(n: number): void
  toBeLessThan(n: number): void
  toBeLessThanOrEqual(n: number): void
  toBeCloseTo(n: number, precision?: number): void
  toContain(item: unknown): void
  toMatch(re: RegExp | string): void
  toHaveLength(n: number): void
  toHaveProperty(key: string, value?: unknown): void
  toMatchObject(expected: object): void
  toThrow(expected?: unknown): void
  toHaveBeenCalled(): void
  toHaveBeenCalledTimes(n: number): void
  toHaveBeenCalledWith(...args: unknown[]): void
  toHaveBeenNthCalledWith(nth: number, ...args: unknown[]): void
}

interface AsyncMatchers {
  toBe(expected: unknown): Promise<void>
  toEqual(expected: unknown): Promise<void>
  toBeNull(): Promise<void>
  toBeUndefined(): Promise<void>
  toBeDefined(): Promise<void>
  toBeTruthy(): Promise<void>
  toBeInstanceOf(ctor: Function): Promise<void>
  toBeGreaterThan(n: number): Promise<void>
  toBeGreaterThanOrEqual(n: number): Promise<void>
  toBeLessThan(n: number): Promise<void>
  toBeLessThanOrEqual(n: number): Promise<void>
  toBeCloseTo(n: number, precision?: number): Promise<void>
  toContain(item: unknown): Promise<void>
  toMatch(re: RegExp | string): Promise<void>
  toHaveLength(n: number): Promise<void>
  toHaveProperty(key: string, value?: unknown): Promise<void>
  toMatchObject(expected: object): Promise<void>
  toThrow(expected?: unknown): Promise<void>
}

export interface Expectation extends Matchers {
  not: Matchers
  rejects: AsyncMatchers
  resolves: AsyncMatchers
}

function fail(operator: string, message: string, actual: unknown, expected: unknown): never {
  throw new AssertionError({ message, actual, expected, operator })
}

function createMatchers(received: unknown, negated: boolean): Matchers {
  function check(
    condition: boolean,
    makeMessage: () => string,
    expected: unknown,
    operator: string,
  ) {
    let pass = negated ? !condition : condition
    if (!pass) {
      let prefix = negated ? 'expected not ' : 'expected '
      fail(operator, prefix + makeMessage(), received, expected)
    }
  }

  return {
    toBe(expected) {
      check(
        Object.is(received, expected),
        () => `${stringify(received)} to be ${stringify(expected)}`,
        expected,
        'toBe',
      )
    },
    toEqual(expected) {
      check(
        isDeepEqual(received, expected),
        () => `${stringify(received)} to deeply equal ${stringify(expected)}`,
        expected,
        'toEqual',
      )
    },
    toBeNull() {
      check(received === null, () => `${stringify(received)} to be null`, null, 'toBeNull')
    },
    toBeUndefined() {
      check(
        received === undefined,
        () => `${stringify(received)} to be undefined`,
        undefined,
        'toBeUndefined',
      )
    },
    toBeDefined() {
      check(
        received !== undefined,
        () => `${stringify(received)} to be defined`,
        undefined,
        'toBeDefined',
      )
    },
    toBeTruthy() {
      check(Boolean(received), () => `${stringify(received)} to be truthy`, true, 'toBeTruthy')
    },
    toBeInstanceOf(ctor) {
      check(
        received instanceof (ctor as any),
        () => `${stringify(received)} to be instance of ${ctor.name || ctor}`,
        ctor,
        'toBeInstanceOf',
      )
    },
    toBeGreaterThan(n) {
      check(
        typeof received === 'number' && received > n,
        () => `${stringify(received)} to be greater than ${n}`,
        n,
        'toBeGreaterThan',
      )
    },
    toBeGreaterThanOrEqual(n) {
      check(
        typeof received === 'number' && received >= n,
        () => `${stringify(received)} to be greater than or equal to ${n}`,
        n,
        'toBeGreaterThanOrEqual',
      )
    },
    toBeLessThan(n) {
      check(
        typeof received === 'number' && received < n,
        () => `${stringify(received)} to be less than ${n}`,
        n,
        'toBeLessThan',
      )
    },
    toBeLessThanOrEqual(n) {
      check(
        typeof received === 'number' && received <= n,
        () => `${stringify(received)} to be less than or equal to ${n}`,
        n,
        'toBeLessThanOrEqual',
      )
    },
    toBeCloseTo(n, precision = 2) {
      let diff = Math.abs((received as number) - n)
      let tolerance = Math.pow(10, -precision) / 2
      check(
        typeof received === 'number' && diff < tolerance,
        () => `${stringify(received)} to be close to ${n} (precision ${precision})`,
        n,
        'toBeCloseTo',
      )
    },
    toContain(item) {
      let contained: boolean
      if (typeof received === 'string') {
        contained = received.includes(String(item))
      } else if (Array.isArray(received) || received instanceof Set) {
        let arr = Array.isArray(received) ? received : Array.from(received)
        contained = arr.some((v) => Object.is(v, item) || v === item)
      } else if (received != null && typeof (received as any)[Symbol.iterator] === 'function') {
        contained = Array.from(received as Iterable<unknown>).some(
          (v) => Object.is(v, item) || v === item,
        )
      } else {
        contained = false
      }
      check(
        contained,
        () => `${stringify(received)} to contain ${stringify(item)}`,
        item,
        'toContain',
      )
    },
    toMatch(re) {
      let pattern = typeof re === 'string' ? new RegExp(escapeRegex(re)) : re
      check(
        typeof received === 'string' && pattern.test(received),
        () => `${stringify(received)} to match ${pattern}`,
        re,
        'toMatch',
      )
    },
    toHaveLength(n) {
      let len = (received as { length?: number })?.length
      check(
        len === n,
        () => `${stringify(received)} to have length ${n} (got ${len})`,
        n,
        'toHaveLength',
      )
    },
    toHaveProperty(key, value) {
      let path = key.split('.')
      let current: any = received
      let exists = true
      for (let segment of path) {
        if (current == null || !(segment in current)) {
          exists = false
          break
        }
        current = current[segment]
      }
      let pass = exists && (arguments.length < 2 || isDeepEqual(current, value))
      check(
        pass,
        () =>
          arguments.length < 2
            ? `${stringify(received)} to have property "${key}"`
            : `${stringify(received)} to have property "${key}" with value ${stringify(value)}`,
        value,
        'toHaveProperty',
      )
    },
    toMatchObject(expected) {
      check(
        matchesPartial(received, expected),
        () => `${stringify(received)} to recursively match ${stringify(expected)}`,
        expected,
        'toMatchObject',
      )
    },
    toThrow(expected) {
      if (typeof received !== 'function') {
        throw new AssertionError({
          message: `expect(received).toThrow() requires a function (got ${typeof received})`,
          operator: 'toThrow',
        })
      }
      let thrown = false
      let error: unknown
      try {
        ;(received as () => unknown)()
      } catch (e) {
        thrown = true
        error = e
      }
      let pass = thrown && checkErrorMatch(error, expected)
      check(
        pass,
        () =>
          thrown
            ? `error to be ${describeExpectedError(expected)}, got ${stringify(error)}`
            : `function to throw ${describeExpectedError(expected)}`,
        expected,
        'toThrow',
      )
    },
    toHaveBeenCalled() {
      let calls = getMockCalls(received, 'toHaveBeenCalled')
      check(
        calls.length > 0,
        () => `mock to have been called (got ${calls.length} calls)`,
        undefined,
        'toHaveBeenCalled',
      )
    },
    toHaveBeenCalledTimes(n) {
      let calls = getMockCalls(received, 'toHaveBeenCalledTimes')
      check(
        calls.length === n,
        () => `mock to have been called ${n} times (got ${calls.length})`,
        n,
        'toHaveBeenCalledTimes',
      )
    },
    toHaveBeenCalledWith(...args) {
      let calls = getMockCalls(received, 'toHaveBeenCalledWith')
      let matched = calls.some((call) => isDeepEqual(call.arguments, args))
      check(
        matched,
        () =>
          `mock to have been called with ${stringify(args)} (calls: ${stringify(
            calls.map((c) => c.arguments),
          )})`,
        args,
        'toHaveBeenCalledWith',
      )
    },
    toHaveBeenNthCalledWith(nth, ...args) {
      let calls = getMockCalls(received, 'toHaveBeenNthCalledWith')
      let call = calls[nth - 1]
      let matched = !!call && isDeepEqual(call.arguments, args)
      check(
        matched,
        () =>
          `mock call #${nth} to be ${stringify(args)} (got ${
            call ? stringify(call.arguments) : '<no call>'
          })`,
        args,
        'toHaveBeenNthCalledWith',
      )
    },
  }
}

function createAsyncMatchers(
  promise: Promise<unknown> | (() => unknown),
  mode: 'resolves' | 'rejects',
  negated: boolean,
): AsyncMatchers {
  async function settle(): Promise<{ resolved: boolean; value?: unknown; error?: unknown }> {
    try {
      let value = await (typeof promise === 'function' ? promise() : promise)
      return { resolved: true, value }
    } catch (error) {
      return { resolved: false, error }
    }
  }

  function buildMatcher(matcher: keyof Matchers) {
    return async (...args: unknown[]) => {
      let result = await settle()
      if (mode === 'resolves') {
        if (!result.resolved) {
          throw new AssertionError({
            message: `expected promise to resolve, but it rejected with: ${stringify(result.error)}`,
            actual: result.error,
            operator: `resolves.${matcher}`,
          })
        }
        let m = createMatchers(result.value, negated) as any
        m[matcher](...args)
      } else {
        if (result.resolved) {
          throw new AssertionError({
            message: `expected promise to reject, but it resolved with: ${stringify(result.value)}`,
            actual: result.value,
            operator: `rejects.${matcher}`,
          })
        }
        // For rejects.toThrow we check the error against the expected matcher.
        if (matcher === 'toThrow') {
          let pass = checkErrorMatch(result.error, args[0])
          if (negated ? pass : !pass) {
            throw new AssertionError({
              message:
                (negated ? 'expected not ' : 'expected ') +
                `error to be ${describeExpectedError(args[0])}, got ${stringify(result.error)}`,
              actual: result.error,
              expected: args[0],
              operator: `rejects.toThrow`,
            })
          }
          return
        }
        let m = createMatchers(result.error, negated) as any
        m[matcher](...args)
      }
    }
  }

  return {
    toBe: buildMatcher('toBe'),
    toEqual: buildMatcher('toEqual'),
    toBeNull: buildMatcher('toBeNull'),
    toBeUndefined: buildMatcher('toBeUndefined'),
    toBeDefined: buildMatcher('toBeDefined'),
    toBeTruthy: buildMatcher('toBeTruthy'),
    toBeInstanceOf: buildMatcher('toBeInstanceOf'),
    toBeGreaterThan: buildMatcher('toBeGreaterThan'),
    toBeGreaterThanOrEqual: buildMatcher('toBeGreaterThanOrEqual'),
    toBeLessThan: buildMatcher('toBeLessThan'),
    toBeLessThanOrEqual: buildMatcher('toBeLessThanOrEqual'),
    toBeCloseTo: buildMatcher('toBeCloseTo'),
    toContain: buildMatcher('toContain'),
    toMatch: buildMatcher('toMatch'),
    toHaveLength: buildMatcher('toHaveLength'),
    toHaveProperty: buildMatcher('toHaveProperty'),
    toMatchObject: buildMatcher('toMatchObject'),
    toThrow: buildMatcher('toThrow'),
  } as AsyncMatchers
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function stringify(value: unknown): string {
  if (value === undefined) return 'undefined'
  if (typeof value === 'function')
    return `[Function${(value as Function).name ? ': ' + (value as Function).name : ''}]`
  if (value instanceof Error) return `${value.name}: ${value.message}`
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/**
 * jest/vitest-style expect API. Returns an object of matchers that throw
 * {@link AssertionError} on failure. Supports `.not` for negation and
 * `.rejects` / `.resolves` for asserting on promises.
 *
 * Mock-aware matchers (`toHaveBeenCalled*`) read `received.mock.calls[i].arguments`,
 * which is the shape produced by `mock.fn()` from `@remix-run/test`.
 *
 * @example
 * expect(value).toBe(42)
 * expect(value).not.toBeNull()
 * await expect(fetch('/missing')).rejects.toThrow('Not found')
 * await expect(loadModule()).resolves.toBeUndefined()
 *
 * @param received - The value or function or promise to assert against.
 * @returns An {@link Expectation} object exposing matchers, `.not`,
 *          `.rejects`, and `.resolves`.
 */
function expectImpl(received: unknown): Expectation {
  return {
    ...createMatchers(received, false),
    not: createMatchers(received, true),
    rejects: createAsyncMatchers(received as any, 'rejects', false),
    resolves: createAsyncMatchers(received as any, 'resolves', false),
  }
}

/**
 * Asymmetric matcher used as the `expected` value in `toEqual`. The actual
 * value passes if it has at least the keys in `expected` (with matching
 * values) — extra keys are allowed.
 *
 * @example
 * expect({ a: 1, b: 2 }).toEqual(expect.objectContaining({ a: 1 }))
 *
 * @param expected - Subset of keys (and values) the actual value must contain.
 * @returns A sentinel-tagged object `toEqual` recognizes as a partial matcher.
 */
function objectContaining<T extends object>(expected: T): T {
  return { [PARTIAL_MATCHER]: true, expected } as unknown as T
}

export const expect = Object.assign(expectImpl, { objectContaining })
