import * as assert from '@remix-run/assert'
import { describe, it, mock } from '../index.ts'
import { createTestContext, type TestContext } from '../lib/context.ts'
import { runTests } from '../lib/executor.ts'

describe('mock function controls', () => {
  it('calls Map.get spies without recursing into mock bookkeeping', () => {
    let original = Map.prototype.get
    let spy = mock.method(Map.prototype, 'get', () => 123)
    let result: unknown
    try {
      result = new Map().get('key')
    } finally {
      Map.prototype.get = original
    }
    assert.equal(result, 123)
    assert.equal(spy.mock.callCount(), 1)
  })

  it('calls Map.delete spies without recursing into mock bookkeeping', () => {
    let original = Map.prototype.delete
    let spy = mock.method(Map.prototype, 'delete', () => false)
    let result: unknown
    try {
      result = new Map().delete('key')
    } finally {
      Map.prototype.delete = original
    }
    assert.equal(result, false)
    assert.equal(spy.mock.callCount(), 1)
  })

  it('schedules one-call overrides while Map.set is mocked', () => {
    let original = Map.prototype.set
    let fn = mock.fn(() => 'default')
    let spy = mock.method(Map.prototype, 'set', function (this: Map<unknown, unknown>) {
      return this
    })
    let results: string[]
    try {
      fn.mock.mockImplementationOnce(() => 'once')
      results = [fn(), fn()]
    } finally {
      Map.prototype.set = original
    }
    assert.deepEqual(results, ['once', 'default'])
    assert.equal(spy.mock.callCount(), 0)
  })

  it('schedules and validates overrides without calling a mocked integer validator', () => {
    let original = Number.isSafeInteger
    let spy = mock.method(Number, 'isSafeInteger')
    try {
      spy.mock.mockImplementationOnce(() => false)
      assert.equal(spy.mock.callCount(), 0)
      assert.equal(Number.isSafeInteger(3), false)
      assert.equal(Number.isSafeInteger(3), true)

      spy.mock.mockImplementation(() => true)
      assert.throws(() => spy.mock.mockImplementationOnce(() => false, 2.5), RangeError)
      assert.equal(spy.mock.callCount(), 2)
      spy.mock.mockImplementationOnce(() => false, 3)
      assert.equal(spy.mock.callCount(), 2)
      assert.equal(Number.isSafeInteger(3), true)
      assert.equal(Number.isSafeInteger(3), false)
      assert.equal(Number.isSafeInteger(3), true)
    } finally {
      Number.isSafeInteger = original
    }
  })

  it('automatically restores Object.defineProperty without calling its replacement', async () => {
    let original = Object.defineProperty
    let obj = { method: () => 'original' }
    let { testContext, cleanup } = createTestContext()
    let spy = testContext.mock.method(Object, 'defineProperty', (target: object) => target)
    testContext.mock.method(obj, 'method', () => 'mocked')
    let restored: boolean
    try {
      await cleanup()
      restored = Object.defineProperty === original
    } finally {
      Object.defineProperty = original
    }
    assert.equal(restored, true)
    assert.equal(obj.method(), 'original')
    assert.equal(spy.mock.callCount(), 0)
  })

  it('preserves generic function contracts in replacement controls', (t) => {
    function identity<value>(value: value): value {
      return value
    }
    let fn = mock.fn(identity)
    let contextFn = t.mock.fn(identity)
    let obj = { identity }
    let spy = t.mock.method(obj, 'identity')

    type DefaultReplacement = Parameters<typeof fn.mock.mockImplementation>[0]
    type ContextReplacement = Parameters<typeof contextFn.mock.mockImplementation>[0]
    type OnceReplacement = Parameters<typeof spy.mock.mockImplementationOnce>[0]
    let invalidDefault: (() => string) extends DefaultReplacement ? true : false = false
    let invalidContext: (() => string) extends ContextReplacement ? true : false = false
    let invalidOnce: (() => string) extends OnceReplacement ? true : false = false
    assert.equal(invalidDefault, false)
    assert.equal(invalidContext, false)
    assert.equal(invalidOnce, false)

    fn.mock.mockImplementation((value) => value)
    contextFn.mock.mockImplementation((value) => value)
    spy.mock.mockImplementationOnce((value) => value)
    let number: number = fn(123)
    let contextNumber: number = contextFn(123)
    let text: string = obj.identity('value')
    assert.equal(number, 123)
    assert.equal(contextNumber, 123)
    assert.equal(text, 'value')
  })

  it('preserves every overload in replacement controls', (t) => {
    function value(input: string): string
    function value(input: number): number
    function value(input: string | number): string | number {
      return input
    }
    let fn = mock.fn(value)
    let obj = { value }
    let spy = t.mock.method(obj, 'value')

    type OnceReplacement = Parameters<typeof fn.mock.mockImplementationOnce>[0]
    type DefaultReplacement = Parameters<typeof spy.mock.mockImplementation>[0]
    let invalidOnce: ((input: number) => number) extends OnceReplacement ? true : false = false
    let invalidDefault: ((input: number) => number) extends DefaultReplacement ? true : false =
      false
    assert.equal(invalidOnce, false)
    assert.equal(invalidDefault, false)

    fn.mock.mockImplementationOnce(value)
    spy.mock.mockImplementation(value)
    let text: string = fn('value')
    let number: number = obj.value(123)
    assert.equal(text, 'value')
    assert.equal(number, 123)
  })

  it('changes the default without clearing indexed overrides', (t) => {
    let fn = t.mock.fn((value: number) => value * 2)
    assert.equal(
      fn.mock.mockImplementationOnce((value) => value * 3, 1),
      undefined,
    )
    assert.equal(
      fn.mock.mockImplementation((value) => value * 4),
      undefined,
    )
    assert.equal(fn(2), 8)
    assert.equal(fn(2), 6)
    assert.equal(fn(2), 8)
    assert.equal(fn.mock.callCount(), 3)
    assert.deepEqual(
      fn.mock.calls.map((call) => call.result),
      [8, 6, 8],
    )
  })

  it('replaces repeated registrations for the same next or explicit call', () => {
    let fn = mock.fn(() => 'default')
    fn.mock.mockImplementationOnce(() => 'first')
    fn.mock.mockImplementationOnce(() => 'next')
    fn.mock.mockImplementationOnce(() => 'third', 2)
    fn.mock.mockImplementationOnce(() => 'replaced', 2)
    assert.deepEqual([fn(), fn(), fn(), fn()], ['next', 'default', 'replaced', 'default'])
  })

  it('resets history and call indices while preserving pending overrides', () => {
    let fn = mock.fn(() => 'original')
    let calls = fn.mock.calls
    fn.mock.mockImplementation(() => 'default')
    fn.mock.mockImplementationOnce(() => 'once', 1)
    assert.equal(fn(), 'default')
    assert.equal(calls.length, 1)
    assert.equal(fn.mock.resetCalls(), undefined)
    assert.notEqual(fn.mock.calls, calls)
    assert.equal(fn.mock.callCount(), 0)
    assert.deepEqual([fn(), fn(), fn()], ['default', 'once', 'default'])
    assert.equal(calls.length, 1)
    assert.equal(fn.mock.callCount(), 3)
    fn.mock.resetCalls()
    assert.deepEqual([fn(), fn()], ['default', 'default'])
  })

  it('consumes a throwing override and records the original thrown value', () => {
    let error = new Error('once failed')
    let fn = mock.fn(() => 'default')
    fn.mock.mockImplementationOnce(() => {
      assert.equal(fn.mock.callCount(), 1)
      throw error
    })
    assert.throws(
      () => fn(),
      (value: unknown) => value === error,
    )
    assert.equal(fn.mock.calls[0].error, error)
    assert.equal(fn.mock.callCount(), 1)
    assert.equal(fn(), 'default')
    fn.mock.resetCalls()
    assert.equal(fn(), 'default')
  })

  it('returns and records the original promise without awaiting it', async () => {
    let { promise, resolve } = Promise.withResolvers<number>()
    let error = new Error('rejected')
    let fn = mock.fn(async () => 0)
    fn.mock.mockImplementation(() => promise)
    let rejected = Promise.reject(error)
    fn.mock.mockImplementationOnce(() => rejected)
    assert.equal(fn(), rejected)
    assert.equal(fn.mock.calls[0].result, rejected)
    assert.equal(fn.mock.calls[0].error, undefined)
    await assert.rejects(rejected, (value: unknown) => value === error)
    assert.equal(fn(), promise)
    assert.equal(fn.mock.calls[1].result, promise)
    assert.equal(fn.mock.callCount(), 2)
    resolve(42)
    assert.equal(await promise, 42)
    assert.equal(fn.mock.callCount(), 2)
  })

  it('keeps the live call array and records calls before reentrant execution', () => {
    let fn = mock.fn((value: number): number => value)
    let calls = fn.mock.calls
    fn.mock.mockImplementation((value) => {
      assert.equal(calls.length, 1)
      assert.equal(fn.mock.callCount(), 1)
      assert.deepEqual(calls[0], { arguments: [value] })
      fn.mock.mockImplementationOnce((next) => {
        assert.equal(fn.mock.callCount(), 2)
        return next * 2
      })
      return fn(value)
    })
    assert.equal(fn(3), 6)
    assert.equal(fn.mock.calls, calls)
    assert.deepEqual(calls, [
      { arguments: [3], result: 6 },
      { arguments: [3], result: 6 },
    ])
    calls.length = 0
    assert.equal(fn.mock.callCount(), 0)
  })

  it('records subsequent calls in the new history when reset inside an implementation', () => {
    let fn = mock.fn(() => 1)
    let calls = fn.mock.calls
    fn.mock.mockImplementationOnce(() => {
      assert.equal(fn.mock.callCount(), 1)
      fn.mock.resetCalls()
      assert.equal(fn.mock.callCount(), 0)
      assert.deepEqual(fn.mock.calls, [])
      return fn()
    })
    assert.equal(fn(), 1)
    assert.equal(fn.mock.callCount(), 1)
    assert.deepEqual(fn.mock.calls, [{ arguments: [], result: 1 }])
    assert.deepEqual(calls, [{ arguments: [], result: 1 }])
    assert.notEqual(fn.mock.calls, calls)
  })

  it('rejects invalid replacements and indices without changing mock state', () => {
    let fn = mock.fn(() => 'default')
    fn()
    fn.mock.mockImplementationOnce(() => 'once')
    for (let implementation of [undefined, null, false, 1, 'function', {}]) {
      assert.throws(
        () => Reflect.apply(fn.mock.mockImplementation, fn.mock, [implementation]),
        TypeError,
      )
      assert.throws(
        () => Reflect.apply(fn.mock.mockImplementationOnce, fn.mock, [implementation]),
        TypeError,
      )
    }
    for (let onCall of [-1, 0, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      assert.throws(() => fn.mock.mockImplementationOnce(() => 'invalid', onCall), RangeError)
    }
    assert.equal(fn.mock.callCount(), 1)
    assert.deepEqual([fn(), fn()], ['once', 'default'])
  })

  it('rejects non-number call indices with TypeError without changing mock state', () => {
    let fn = mock.fn(() => 'default')
    fn()
    fn.mock.mockImplementationOnce(() => 'once')
    for (let onCall of ['1', true, {}, [], 1n, Symbol('index')]) {
      assert.throws(
        () => Reflect.apply(fn.mock.mockImplementationOnce, fn.mock, [() => 'invalid', onCall]),
        TypeError,
      )
    }
    assert.equal(fn.mock.callCount(), 1)
    assert.deepEqual([fn(), fn()], ['once', 'default'])
  })

  it('restores a standalone default while preserving pending overrides and history', () => {
    let fn = mock.fn(() => 'original')
    fn.mock.mockImplementation(() => 'replacement')
    fn.mock.mockImplementationOnce(() => 'once', 1)
    assert.equal(fn(), 'replacement')
    assert.equal(fn.mock.restore(), undefined)
    assert.deepEqual([fn(), fn()], ['once', 'original'])
    assert.equal(fn.mock.callCount(), 3)
    fn.mock.mockImplementation(() => 'changed again')
    fn.mock.restore()
    assert.equal(fn(), 'original')
  })

  it('restores a mock with no original implementation to returning undefined', () => {
    let fn = mock.fn()
    fn.mock.mockImplementation(() => 1)
    assert.equal(fn(), 1)
    fn.mock.restore()
    assert.equal(fn(), undefined)
    assert.equal(fn.mock.callCount(), 2)
  })

  it('preserves method receivers and infers replacement parameters and results', (t) => {
    let obj = {
      base: 5,
      add(this: { base: number }, value: number) {
        return this.base + value
      },
    }
    let spy = t.mock.method(obj, 'add')
    spy.mock.mockImplementation(function (value) {
      return this.base + value * 2
    })
    spy.mock.mockImplementationOnce(function (value) {
      return this.base + value * 3
    })
    assert.equal(obj.add(2), 11)
    assert.equal(obj.add(2), 9)
    assert.equal(spy.call({ base: 10 }, 2), 14)

    type Replacement = Parameters<typeof spy.mock.mockImplementation>[0]
    let wrongArgument: ((value: string) => number) extends Replacement ? true : false = false
    let wrongResult: ((value: number) => string) extends Replacement ? true : false = false
    assert.equal(wrongArgument, false)
    assert.equal(wrongResult, false)
  })

  it('restores the original descriptor on every call and leaves retained spies usable', () => {
    let obj = {
      method() {
        return 'original'
      },
    }
    Object.defineProperty(obj, 'method', { enumerable: false })
    let descriptor = Object.getOwnPropertyDescriptor(obj, 'method')
    let spy = mock.method(obj, 'method', () => 'mocked')
    spy.mock.mockImplementation(() => 'replacement')
    assert.equal(obj.method(), 'replacement')
    Object.defineProperty(obj, 'method', { enumerable: true, writable: false })
    assert.equal(spy.mock.restore(), undefined)
    assert.deepEqual(Object.getOwnPropertyDescriptor(obj, 'method'), descriptor)
    assert.equal(obj.method(), 'original')
    assert.equal(spy(), 'replacement')
    let replacement = () => 'later'
    obj.method = replacement
    spy.mock.restore()
    assert.equal(obj.method(), 'original')
    assert.deepEqual(Object.getOwnPropertyDescriptor(obj, 'method'), descriptor)
  })

  it('preserves permissive initial implementations for overloaded context methods', (t) => {
    function value(input: number): number
    function value(input: string): string
    function value(input: number | string): number | string {
      return input
    }
    let obj = { value }
    let spy = t.mock.method(obj, 'value', (input: number) => input * 2)
    assert.equal(obj.value(3), 6)
    spy.mock.restore()
    assert.equal(obj.value('original'), 'original')
  })

  it('preserves the own property when restoring an inherited method', () => {
    class Counter {
      value() {
        return 1
      }
    }
    let obj = new Counter()
    let spy = mock.method(obj, 'value')
    spy.mock.mockImplementation(() => 2)
    assert.equal(obj.value(), 2)
    spy.mock.restore()
    assert.equal(Object.hasOwn(obj, 'value'), true)
    assert.equal(obj.value(), 1)
  })

  it('preserves permissive standalone spy calls and recorded results', () => {
    let obj = {
      value(input: number) {
        return input * 2
      },
    }
    let spy = mock.method(obj, 'value', () => 'stub')
    let result: string = spy('legacy argument')
    let recorded: string = spy.mock.calls[0].result
    assert.equal(result, 'stub')
    assert.equal(recorded.toUpperCase(), 'STUB')
    spy.mock.restore()
  })

  it('preserves permissive context spy calls and recorded results', (t) => {
    let obj = {
      value(input: number) {
        return input * 2
      },
    }
    let spy = t.mock.method(obj, 'value', (input: string) => input.toUpperCase())
    let result: string = spy('legacy argument')
    let recorded: string = spy.mock.calls[0].result
    assert.equal(result, 'LEGACY ARGUMENT')
    assert.equal(recorded, result)
  })

  it('mocks and restores an accessor-backed function through its setter', () => {
    let original = () => 1
    let current = original
    let obj = {
      get method() {
        return current
      },
      set method(value) {
        current = value
      },
    }
    let descriptor = Object.getOwnPropertyDescriptor(obj, 'method')
    let spy = mock.method(obj, 'method', () => 2)
    assert.equal(current, spy)
    spy.mock.mockImplementationOnce(() => 3)
    assert.equal(obj.method(), 3)
    assert.equal(obj.method(), 2)
    spy.mock.restore()
    assert.equal(current, original)
    assert.deepEqual(Object.getOwnPropertyDescriptor(obj, 'method'), descriptor)
    current = () => 4
    spy.mock.restore()
    assert.equal(current, original)
  })

  it('mocks an inherited accessor without replacing it with a data property', (t) => {
    let original = () => 1
    class Counter {
      #method = original
      get method() {
        return this.#method
      }
      set method(value) {
        this.#method = value
      }
    }
    let obj = new Counter()
    let spy = t.mock.method(obj, 'method', () => 2)
    assert.equal(Object.hasOwn(obj, 'method'), false)
    assert.equal(obj.method(), 2)
    spy.mock.restore()
    assert.equal(Object.hasOwn(obj, 'method'), false)
    assert.equal(obj.method, original)
  })

  it('supports standalone mocks of initially undefined methods', () => {
    let obj: { method?: () => number } = {}
    let spy = mock.method(obj, 'method')
    assert.equal(spy(), undefined)
    spy.mock.mockImplementation(() => 2)
    assert.equal(obj.method?.(), 2)
    spy.mock.restore()
    assert.equal(Object.hasOwn(obj, 'method'), true)
    assert.equal(obj.method, undefined)
  })

  it('supports context overrides of initially undefined methods', (t) => {
    let obj: { method?: () => number } = { method: undefined }
    let spy = t.mock.method(obj, 'method', () => 2)
    assert.equal(obj.method?.(), 2)
    spy.mock.mockImplementationOnce(() => 3)
    assert.equal(obj.method?.(), 3)
    spy.mock.restore()
    assert.equal(obj.method, undefined)
  })

  it('allows replacement controls when the original property has no function type', (t) => {
    let obj = { method: undefined }
    let spy = t.mock.method(obj, 'method', () => 'initial')
    assert.equal(obj.method, spy)
    spy.mock.mockImplementation(() => 'replacement')
    assert.equal(spy(), 'replacement')
    spy.mock.restore()
    assert.equal(obj.method, undefined)
  })

  it('preserves registration order between mock restoration and cleanup callbacks', async () => {
    let obj = {
      method() {
        return 'original'
      },
    }
    let { testContext, cleanup } = createTestContext()
    let events: string[] = []
    testContext.after(() => {
      events.push(fn(), obj.method())
    })
    let fn = testContext.mock.fn(() => 'original function')
    fn.mock.mockImplementation(() => 'mocked function')
    testContext.mock.method(obj, 'method', () => 'mocked')
    testContext.after(() => {
      events.push(fn(), obj.method())
    })
    await cleanup()
    assert.deepEqual(events, ['mocked function', 'mocked', 'original function', 'original'])
  })

  it('restores overlapping method mocks without reinstalling an earlier spy', async () => {
    let obj = {
      method() {
        return 'original'
      },
    }
    let { testContext, cleanup } = createTestContext()
    let first = testContext.mock.method(obj, 'method', () => 'first')
    testContext.mock.method(obj, 'method', () => 'second')
    await cleanup()
    assert.equal(obj.method(), 'original')
    assert.notEqual(obj.method, first)
  })

  it('does not reinstall an already restored spy when nested mocks are cleaned up', async () => {
    let obj = {
      method() {
        return 'original'
      },
    }
    let { testContext, cleanup } = createTestContext()
    let first = testContext.mock.method(obj, 'method', () => 'first')
    testContext.mock.method(obj, 'method', () => 'second')
    first.mock.restore()
    await cleanup()
    assert.equal(obj.method(), 'original')
  })

  it('continues cleanup and the next test while reporting body and cleanup failures', async () => {
    let obj = {
      method() {
        return 'original'
      },
    }
    let events: string[] = []
    let global = globalThis as typeof globalThis & { __testSuites?: unknown[] }
    let previousSuites = global.__testSuites
    global.__testSuites = [
      {
        name: 'mock cleanup fixture',
        afterEach: [
          {
            fn() {
              events.push('afterEach')
            },
          },
        ],
        tests: [
          {
            name: 'failure',
            fn(t: TestContext) {
              t.after(() => {
                throw new Error('cleanup failed')
              })
              t.mock.method(obj, 'method', () => 'mocked')
              t.after(() => {
                events.push('cleanup')
              })
              throw new Error('body failed')
            },
          },
          {
            name: 'next test',
            fn() {
              assert.equal(obj.method(), 'original')
            },
          },
        ],
      },
    ]
    try {
      let results = await runTests()
      assert.equal(results.failed, 1)
      assert.equal(results.passed, 1)
      assert.match(results.tests[0].error?.message ?? '', /body failed/)
      assert.match(results.tests[0].error?.message ?? '', /cleanup failed/)
      assert.deepEqual(events, ['cleanup', 'afterEach', 'afterEach'])
    } finally {
      global.__testSuites = previousSuites
    }
  })
})
