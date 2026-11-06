import * as assert from '@remix-run/assert'
import { describe, it, mock } from '../index.ts'
import type { MockProperty, MockPropertyContext, MockTracker, TestContext } from '../index.ts'
import { createTestContext } from '../lib/context.ts'

describe('mock.property', () => {
  it('mutates and restores a typed proxy while Object.defineProperty is mocked', (t) => {
    let target = { value: 1, other: 'unchanged' }
    Object.defineProperty(target, 'value', { enumerable: false })
    let descriptor = Object.getOwnPropertyDescriptor(target, 'value')
    let defineProperty = t.mock.method(Object, 'defineProperty', (object: object) => object)
    let tracker: MockTracker = mock
    let property: MockProperty<typeof target, 'value'> = tracker.property(target, 'value', 2)
    let context: MockPropertyContext<number> = property.mock
    try {
      let value: number = property.value
      let other: string = property.other
      assert.notEqual(property, target)
      assert.equal(target.value, 2)
      assert.equal(value, 2)
      assert.equal(other, 'unchanged')
      assert.equal(Object.hasOwn(target, 'mock'), false)
      assert.equal(Object.getOwnPropertyDescriptor(target, 'value')?.enumerable, false)
      assert.equal(defineProperty.mock.callCount(), 0)
    } finally {
      context.restore()
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(target, 'value'), descriptor)
  })

  it('distinguishes an omitted value from explicit undefined for string and symbol keys', (t) => {
    let key = Symbol('value')
    let target = { value: 1 as number | undefined, [key]: 'original' as string | undefined }
    let original = t.mock.property(target, 'value')
    assert.equal(target.value, 1)
    original.mock.restore()
    t.mock.property(target, 'value', undefined)
    t.mock.property(target, key, undefined)
    assert.equal(target.value, undefined)
    assert.equal(target[key], undefined)
  })

  it('records reads and writes with values and stacks in snapshot arrays', (t) => {
    let target = { value: 1 }
    let property = t.mock.property(target, 'value', 2)
    assert.equal(property.mock.accessCount(), 0)
    let empty = property.mock.accesses
    assert.equal(target.value, 2)
    target.value = 3
    property.mock.mockImplementation(4)
    assert.equal(target.value, 4)
    let accesses = property.mock.accesses
    assert.deepEqual(
      accesses.map(({ type, value }) => ({ type, value })),
      [
        { type: 'get', value: 2 },
        { type: 'set', value: 3 },
        { type: 'set', value: 4 },
        { type: 'get', value: 4 },
      ],
    )
    assert.ok(
      accesses.every(({ stack }) => stack instanceof Error && typeof stack.stack === 'string'),
    )
    assert.deepEqual(empty, [])
    accesses.pop()
    assert.equal(property.mock.accessCount(), 4)
  })

  it('overwrites and consumes read/write overrides while Map.get is mocked', (t) => {
    let get = t.mock.method(Map.prototype, 'get', () => undefined)
    let target = { value: 1 as number | undefined }
    let property = t.mock.property(target, 'value')
    property.mock.mockImplementationOnce(2)
    property.mock.mockImplementationOnce(3)
    assert.equal(target.value, 3)
    assert.equal(target.value, 1)
    property.mock.mockImplementationOnce(4)
    target.value = 5
    assert.equal(target.value, 4)
    property.mock.mockImplementationOnce(undefined, 5)
    assert.equal(target.value, 4)
    property.mock.mockImplementation(6)
    assert.equal(target.value, undefined)
    assert.deepEqual(
      property.mock.accesses.map(({ value }) => value),
      [3, 1, 4, 4, 4, undefined, undefined],
    )
    assert.equal(get.mock.callCount(), 0)
  })

  it('resets access indices without losing current or scheduled values', (t) => {
    let target = { value: 1 }
    let property = t.mock.property(target, 'value')
    property.mock.mockImplementation(2)
    property.mock.mockImplementationOnce(3, 1)
    let previous = property.mock.accesses
    property.mock.resetAccesses()
    assert.equal(property.mock.accessCount(), 0)
    assert.equal(previous.length, 1)
    assert.equal(target.value, 2)
    assert.equal(target.value, 3)
    assert.equal(target.value, 2)
  })

  it('rejects past and invalid access indices without replacing a scheduled value', (t) => {
    let target = { value: 1 }
    let property = t.mock.property(target, 'value')
    assert.equal(target.value, 1)
    property.mock.mockImplementationOnce(2)
    assert.throws(() => property.mock.mockImplementationOnce(3, 0), RangeError)
    assert.throws(() => property.mock.mockImplementationOnce(3, 1.5), RangeError)
    assert.throws(() => property.mock.mockImplementationOnce(3, Infinity), RangeError)
    assert.throws(() => property.mock.mockImplementationOnce(3, NaN), RangeError)
    assert.equal(target.value, 2)
  })

  it('allows a read-only replacement but rejects writes without consuming an override', (t) => {
    let target = { value: 1 }
    Object.defineProperty(target, 'value', { writable: false })
    let descriptor = Object.getOwnPropertyDescriptor(target, 'value')
    let property = t.mock.property(target, 'value', 2)
    property.mock.mockImplementationOnce(3)
    assert.throws(() => {
      target.value = 4
    }, /cannot be set/)
    assert.throws(() => property.mock.mockImplementation(4), /cannot be set/)
    assert.equal(property.mock.accessCount(), 0)
    assert.equal(target.value, 3)
    assert.equal(target.value, 2)
    property.mock.restore()
    assert.deepEqual(Object.getOwnPropertyDescriptor(target, 'value'), descriptor)
  })

  it('rejects missing, inherited, non-configurable, and accessor properties before mutation', () => {
    let inherited = { value: 1 }
    let target = Object.create(inherited)
    let getterCalls = 0
    let accessor = {
      get value() {
        getterCalls++
        return 1
      },
    }
    let fixed = Object.freeze({ value: 1 as number })
    let descriptor = Object.getOwnPropertyDescriptor(accessor, 'value')
    assert.throws(() => mock.property(target, 'value', 2), /own data property/)
    assert.throws(() => mock.property(target, 'missing', 2), /own data property/)
    assert.throws(() => mock.property(fixed, 'value', 2), /configurable/)
    assert.throws(() => mock.property(accessor, 'value', 2), /getter.*setter/)
    assert.equal(getterCalls, 0)
    assert.deepEqual(Object.getOwnPropertyDescriptors(target), {})
    assert.deepEqual(Object.getOwnPropertyDescriptor(accessor, 'value'), descriptor)
    assert.equal(fixed.value, 1)
    assert.equal(inherited.value, 1)
  })

  it('rejects invalid objects and keys before installing a mock', () => {
    let target = { value: 1 }
    let array = [1]
    let fn = Object.assign(() => {}, { value: 1 })
    assert.throws(() => Reflect.apply(mock.property, mock, [null, 'value', 2]), TypeError)
    assert.throws(() => Reflect.apply(mock.property, mock, [1, 'value', 2]), TypeError)
    assert.throws(() => Reflect.apply(mock.property, mock, [array, '0', 2]), TypeError)
    assert.throws(() => mock.property(fn, 'value', 2), TypeError)
    assert.throws(() => Reflect.apply(mock.property, mock, [target, 1, 2]), TypeError)
    assert.deepEqual(target, { value: 1 })
    assert.deepEqual(array, [1])
    assert.equal(fn.value, 1)
  })

  it('exposes the context through the proxy when the target already has a mock property', (t) => {
    let target = { value: 1, mock: 'original' }
    let descriptor = Object.getOwnPropertyDescriptor(target, 'mock')
    let property = t.mock.property(target, 'mock', 'replacement')
    assert.equal(target.mock, 'replacement')
    assert.equal(property.mock.accessCount(), 1)
    property.mock.restore()
    assert.deepEqual(Object.getOwnPropertyDescriptor(target, 'mock'), descriptor)
    assert.equal(property.mock.accessCount(), 1)
  })

  it('uses ordinary proxy invariants for a fixed target property named mock', (t) => {
    let target = { value: 1, mock: 'fixed' }
    Object.defineProperty(target, 'mock', { writable: false, configurable: false })
    let property = t.mock.property(target, 'value', 2)
    assert.throws(() => property.mock, TypeError)
    assert.equal(target.mock, 'fixed')
  })

  it('does not overwrite changes after early restoration during automatic cleanup', async () => {
    let { testContext, cleanup } = createTestContext()
    let target = {
      value: 1,
      get accessor() {
        return 1
      },
    }
    let property = testContext.mock.property(target, 'value', 2)
    let getter = testContext.mock.getter(target, 'accessor', () => 2)
    property.mock.restore()
    getter.mock.restore?.()
    target.value = 3
    let replacement = () => 3
    Object.defineProperty(target, 'accessor', { get: replacement })
    await cleanup()
    assert.equal(target.value, 3)
    assert.equal(Object.getOwnPropertyDescriptor(target, 'accessor')?.get, replacement)
  })
})

// These compile-time assertions must not install invalid mocks at runtime.
function checkInvalidCalls(t: TestContext) {
  let tracker: MockTracker = t.mock
  let target = { value: 1, mock: 'existing' }
  // @ts-expect-error Replacement values must have the property's type.
  mock.property(target, 'value', 'wrong')
  // @ts-expect-error Context mocks retain the same property key constraint.
  tracker.property(target, 'missing', 1)
  let property = t.mock.property(target, 'value')
  // @ts-expect-error The proxy context replaces the target's string mock field type.
  let originalMock: string = property.mock
  void originalMock
  // @ts-expect-error Property context writes retain the property's value type.
  property.mock.mockImplementation('wrong')
  // @ts-expect-error One-access overrides retain the property's value type.
  property.mock.mockImplementationOnce('wrong')
  // @ts-expect-error Replacement getters must return the property's type.
  tracker.getter(target, 'value', () => 'wrong')
  // @ts-expect-error Replacement setters must accept the property's type.
  mock.setter(target, 'value', (_value: string) => {})
  // @ts-expect-error Method getter options retain the property's result type.
  mock.method(target, 'value', () => 'wrong', { getter: true })
}
void checkInvalidCalls
