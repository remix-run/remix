import * as assert from '@remix-run/assert'
import { describe, it, mock } from '../index.ts'
import { createTestContext } from '../lib/context.ts'

describe('mock.getter and mock.setter', () => {
  it('does not reinstall a restored getter when restoring a standalone method spy', () => {
    let original = () => 1
    let current = original
    let target = {
      get method() {
        return current
      },
      set method(value) {
        current = value
      },
    }
    let descriptor = Object.getOwnPropertyDescriptor(target, 'method')
    let getter = mock.getter(target, 'method', () => () => 2)
    let method = mock.method(target, 'method', () => 3)
    getter.mock.restore()
    method.mock.restore()
    assert.deepEqual(Object.getOwnPropertyDescriptor(target, 'method'), descriptor)
    assert.equal(target.method, original)
    assert.equal(target.method(), 1)
  })

  it('restores a method over an inherited mocked getter without changing its backing value', async () => {
    let original = () => 1
    class Target {
      #method = original
      get method() {
        return this.#method
      }
      set method(value) {
        this.#method = value
      }
    }
    let target = new Target()
    let descriptor = Object.getOwnPropertyDescriptor(Target.prototype, 'method')
    let { testContext, cleanup } = createTestContext()
    testContext.mock.getter(Target.prototype, 'method', () => () => 2)
    let method = testContext.mock.method(target, 'method', () => 3)
    try {
      assert.equal(target.method(), 3)
      assert.equal(method.mock.callCount(), 1)
      target.method = () => 4
      assert.equal(target.method(), 4)
    } finally {
      await cleanup()
    }
    assert.equal(Object.hasOwn(target, 'method'), false)
    assert.deepEqual(Object.getOwnPropertyDescriptor(Target.prototype, 'method'), descriptor)
    assert.equal(target.method, original)
  })

  it('removes inherited accessor shadows after cleanup', async () => {
    class Settings {
      stored = 1
      get value() {
        return this.stored
      }
      set value(value: number) {
        this.stored = value
      }
    }
    let target = new Settings()
    let descriptor = Object.getOwnPropertyDescriptor(Settings.prototype, 'value')
    let { testContext, cleanup } = createTestContext()
    testContext.mock.getter(target, 'value', () => 2)
    testContext.mock.setter(target, 'value', () => {})
    assert.equal(target.value, 2)
    target.value = 3
    assert.equal(target.stored, 1)
    await cleanup()
    assert.equal(Object.hasOwn(target, 'value'), false)
    assert.equal(target.value, 1)
    assert.deepEqual(Object.getOwnPropertyDescriptor(Settings.prototype, 'value'), descriptor)
  })

  it('restores shadows of non-configurable inherited accessors', async () => {
    class Settings {
      get value() {
        return 1
      }
      set value(_value: number) {}
    }
    Object.defineProperty(Settings.prototype, 'value', { configurable: false })
    let target = new Settings()
    let descriptor = Object.getOwnPropertyDescriptor(Settings.prototype, 'value')
    let { testContext, cleanup } = createTestContext()
    testContext.mock.getter(target, 'value', () => 2)
    testContext.mock.setter(target, 'value', () => {})
    assert.equal(target.value, 2)
    await cleanup()
    assert.equal(Object.hasOwn(target, 'value'), false)
    assert.equal(target.value, 1)
    assert.deepEqual(Object.getOwnPropertyDescriptor(Settings.prototype, 'value'), descriptor)
  })

  it('skips restored standalone accessor spies when restoring a later spy', () => {
    let target = {
      get value() {
        return 1
      },
      set value(_value: number) {},
    }
    let descriptor = Object.getOwnPropertyDescriptor(target, 'value')
    let getter = mock.getter(target, 'value', () => 2)
    let setter = mock.setter(target, 'value', () => {})
    getter.mock.restore()
    setter.mock.restore()
    assert.deepEqual(Object.getOwnPropertyDescriptor(target, 'value'), descriptor)
    assert.equal(target.value, 1)
  })

  it('skips restored standalone property mocks when restoring a later accessor spy', () => {
    let target = { value: 1 }
    let descriptor = Object.getOwnPropertyDescriptor(target, 'value')
    let property = mock.property(target, 'value', 2)
    let getter = mock.getter(target, 'value', () => 3)
    property.mock.restore()
    getter.mock.restore()
    assert.deepEqual(Object.getOwnPropertyDescriptor(target, 'value'), descriptor)
    assert.equal(target.value, 1)
  })

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
