import * as assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'

import { AppContext, createKey } from './app-context.ts'

describe('AppContext', () => {
  let context: AppContext
  beforeEach(() => {
    context = new AppContext()
  })

  it('sets and gets values', () => {
    let key = createKey('hello')
    context.set(key, 'world')
    assert.equal(context.get(key), 'world')
  })

  it('gets a default value when one is available', () => {
    let key = createKey('hello')
    assert.equal(context.get(key), 'hello')
  })

  it('allows `null` as a valid default value', () => {
    let key = createKey(null)
    assert.equal(context.get(key), null)
  })

  it('throws an error if a value is not set and no default value is available', () => {
    let key = createKey()
    assert.throws(() => context.get(key), Error)
  })
})
