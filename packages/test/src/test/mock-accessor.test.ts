import * as assert from '@remix-run/assert'
import { describe, it, mock } from '../index.ts'
import { createTestContext } from '../lib/context.ts'

describe('mock.getter and mock.setter', () => {
  it('records original accessor calls with their receiver and restores paired spies', async () => {
    let target = {
      stored: 1,
      get value() {
        return this.stored
      },
      set value(value: number) {
        this.stored = value
      },
    }
    let descriptor = Object.getOwnPropertyDescriptor(target, 'value')
    let { testContext, cleanup } = createTestContext()
    let getter = testContext.mock.getter(target, 'value')
    let setter = testContext.mock.setter(target, 'value')
    target.value = 2
    assert.equal(target.value, 2)
    assert.deepEqual(getter.mock.calls, [{ arguments: [], result: 2 }])
    assert.deepEqual(setter.mock.calls, [{ arguments: [2], result: undefined }])
    await cleanup()
    assert.deepEqual(Object.getOwnPropertyDescriptor(target, 'value'), descriptor)
  })

  it('replaces either accessor with a symbol key while preserving its pair and descriptor', (t) => {
    let key = Symbol('value')
    let stored = 1
    let target = {
      get [key]() {
        return stored
      },
      set [key](value: number) {
        stored = value
      },
    }
    Object.defineProperty(target, key, { enumerable: false })
    let descriptor = Object.getOwnPropertyDescriptor(target, key)
    let getter = t.mock.method(target, key, () => 3, { getter: true })
    assert.equal(Object.getOwnPropertyDescriptor(target, key)?.set, descriptor?.set)
    assert.equal(Object.getOwnPropertyDescriptor(target, key)?.enumerable, false)
    target[key] = 2
    assert.equal(stored, 2)
    let result: number = getter()
    assert.equal(result, 3)
    assert.equal(target[key], 3)
    getter.mock.restore?.()
    assert.deepEqual(Object.getOwnPropertyDescriptor(target, key), descriptor)
    assert.equal(target[key], 2)

    let setter = t.mock.method(
      target,
      key,
      (value) => {
        let numeric: number = value
        stored = numeric * 2
      },
      { setter: true },
    )
    assert.equal(Object.getOwnPropertyDescriptor(target, key)?.get, descriptor?.get)
    assert.equal(Object.getOwnPropertyDescriptor(target, key)?.enumerable, false)
    target[key] = 2
    assert.equal(target[key], 4)
    let arg: number = setter.mock.calls[0].arguments[0]
    assert.equal(arg, 2)
    setter.mock.restore?.()
    assert.deepEqual(Object.getOwnPropertyDescriptor(target, key), descriptor)
  })

  it('records thrown accessor errors and restores standalone spies', () => {
    let failure = new Error('getter failed')
    let target = {
      get value(): number {
        throw failure
      },
    }
    let descriptor = Object.getOwnPropertyDescriptor(target, 'value')
    let getter = mock.getter(target, 'value')
    try {
      assert.throws(
        () => target.value,
        (error: unknown) => error === failure,
      )
      assert.equal(getter.mock.calls[0].error, failure)
    } finally {
      getter.mock.restore?.()
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(target, 'value'), descriptor)
  })

  it('rejects both accessor flags and invalid targets without evaluating a getter', () => {
    let reads = 0
    let target = {
      get value() {
        reads++
        return 1
      },
    }
    let descriptor = Object.getOwnPropertyDescriptor(target, 'value')
    assert.throws(
      () =>
        Reflect.apply(mock.method, mock, [
          target,
          'value',
          undefined,
          { getter: true, setter: true },
        ]),
      /cannot both be true/,
    )
    assert.throws(() => mock.setter(target, 'value'), /selected accessor/)
    assert.throws(() => mock.getter({ value: 1 }, 'value'), /selected accessor/)
    assert.throws(() => Reflect.apply(mock.getter, mock, [target, 'missing']), /selected accessor/)
    assert.throws(() => Reflect.apply(mock.getter, mock, [target, 'value', 1]), /function/)
    assert.throws(
      () => Reflect.apply(mock.method, mock, [target, 'value', undefined, { getter: 'yes' }]),
      /booleans/,
    )
    assert.throws(
      () => Reflect.apply(mock.method, mock, [target, 'value', undefined, null]),
      /options/,
    )
    assert.equal(reads, 0)
    assert.deepEqual(Object.getOwnPropertyDescriptor(target, 'value'), descriptor)
  })

  it('rejects a non-configurable accessor without changing either half', () => {
    let target = {
      get value() {
        return 1
      },
      set value(_value: number) {},
    }
    Object.defineProperty(target, 'value', { configurable: false })
    let descriptor = Object.getOwnPropertyDescriptor(target, 'value')
    assert.throws(() => mock.getter(target, 'value', () => 2), TypeError)
    assert.throws(() => mock.setter(target, 'value', () => {}), TypeError)
    assert.deepEqual(Object.getOwnPropertyDescriptor(target, 'value'), descriptor)
  })

  it('unwinds stacked spies even after an earlier spy was manually restored', async () => {
    let target = {
      get value() {
        return 1
      },
      set value(_value: number) {},
    }
    let descriptor = Object.getOwnPropertyDescriptor(target, 'value')
    let { testContext, cleanup } = createTestContext()
    let getter = testContext.mock.getter(target, 'value', () => 2)
    testContext.mock.setter(target, 'value', () => {})
    getter.mock.restore?.()
    await cleanup()
    assert.deepEqual(Object.getOwnPropertyDescriptor(target, 'value'), descriptor)
  })

  it('unwinds a property mock after an accessor spy reinstalls it', async () => {
    let target = { value: 1 }
    let descriptor = Object.getOwnPropertyDescriptor(target, 'value')
    let { testContext, cleanup } = createTestContext()
    let property = testContext.mock.property(target, 'value', 2)
    testContext.mock.getter(target, 'value', () => 3)
    property.mock.restore()
    await cleanup()
    assert.deepEqual(Object.getOwnPropertyDescriptor(target, 'value'), descriptor)
  })

  it('preserves existing method spy behavior including symbols, callable targets, and overloads', (t) => {
    let key = Symbol('method')
    function original(value: number): number
    function original(value: string): string
    function original(value: number | string): number | string {
      return typeof value === 'number' ? value * 2 : value
    }
    let target = Object.assign(() => {}, { [key]: original })
    let descriptor = Object.getOwnPropertyDescriptor(target, key)
    let method = t.mock.method(target, key)
    assert.equal(target[key](3), 6)
    assert.equal(method.mock.calls[0].result, 6)
    method.mock.restore?.()
    assert.deepEqual(Object.getOwnPropertyDescriptor(target, key), descriptor)
    t.mock.method(target, key, (value: number) => value + 1)
    assert.equal(target[key](3), 4)
  })
})
