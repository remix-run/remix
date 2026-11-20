import * as assert from '@remix-run/assert'
import { describe, it } from '../index.ts'
import { createTestContext } from '../lib/context.ts'

describe('browser property mocks', () => {
  it('mocks navigator.onLine on its actual descriptor owner and restores it', async () => {
    let descriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine')
    assert.ok(descriptor?.get)
    assert.equal(Object.hasOwn(navigator, 'onLine'), false)
    let original = navigator.onLine
    let { testContext, cleanup } = createTestContext()
    let getter = testContext.mock.getter(Navigator.prototype, 'onLine', () => !original)
    try {
      assert.equal(navigator.onLine, !original)
      assert.equal(getter.mock.calls.length, 1)
    } finally {
      await cleanup()
    }
    assert.deepEqual(Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine'), descriptor)
    assert.equal(navigator.onLine, original)
  })

  it('tracks data reads and writes and restores the original descriptor', async () => {
    let key = Symbol('setting')
    let target = { [key]: 1 }
    let descriptor = Object.getOwnPropertyDescriptor(target, key)
    let { testContext, cleanup } = createTestContext()
    let property = testContext.mock.property(target, key, 2)
    property.mock.mockImplementationOnce(3)
    assert.equal(target[key], 3)
    target[key] = 4
    assert.equal(target[key], 4)
    assert.equal(property.mock.accessCount(), 3)
    await cleanup()
    assert.deepEqual(Object.getOwnPropertyDescriptor(target, key), descriptor)
  })
})
