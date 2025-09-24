import * as assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'

import { AppStorage, createStorageKey } from './app-storage.ts'

describe('AppStorage', () => {
  let storage: AppStorage
  beforeEach(() => {
    storage = new AppStorage()
  })

  it('sets and gets values', () => {
    let key = createStorageKey('hello')
    storage.set(key, 'world')
    assert.equal(storage.get(key), 'world')
  })

  it('gets a default value when one is available', () => {
    let key = createStorageKey('hello')
    assert.equal(storage.get(key), 'hello')
  })

  it('allows `null` as a valid default value', () => {
    let key = createStorageKey(null)
    assert.equal(storage.get(key), null)
  })

  it('throws an error if a value is not set and no default value is available', () => {
    let key = createStorageKey()
    assert.throws(() => storage.get(key), Error)
  })
})
