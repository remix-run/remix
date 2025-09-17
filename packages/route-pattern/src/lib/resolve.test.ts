import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { resolve } from './resolve.ts'
import type { Resolve } from './resolve.ts'
import type { Assert, IsEqual } from '../type-utils.d.ts'

describe('resolve', () => {
  it('resolves empty input and base', () => {
    assert.equal(resolve('', ''), '')
  })

  it('resolves empty input', () => {
    assert.equal(resolve('', 'hello'), 'hello')
  })

  it('resolves empty base', () => {
    assert.equal(resolve('hello', ''), 'hello')
  })

  it('uses protocol, hostname, and port from input when present', () => {
    assert.equal(resolve('https://remix.run', 'http://example.com:8080'), 'https://remix.run')
    assert.equal(resolve('://remix.run', 'http://example.com:8080'), '://remix.run')
    assert.equal(resolve('://remix.run:8080', 'http://example.com'), '://remix.run:8080')
  })

  it('uses protocol, hostname, and port from base when none is provided in input', () => {
    assert.equal(resolve('api', 'https://remix.run'), 'https://remix.run/api')
    assert.equal(resolve('api', 'https://remix.run:8080'), 'https://remix.run:8080/api')
  })

  it('resolves input with absolute pathname', () => {
    assert.equal(resolve('/hello', '/world'), '/world/hello')
    // ignore trailing slash on base
    assert.equal(resolve('/hello', '/world/'), '/world/hello')
  })

  it('resolves input with relative pathname', () => {
    assert.equal(resolve('world', 'hello'), 'hello/world')
    // ignore trailing slash on base
    assert.equal(resolve('world', 'hello/'), 'hello/world')
  })

  it('resolves input with search params', () => {
    assert.equal(resolve('?q=1', 'https://remix.run'), 'https://remix.run?q=1')
  })

  it('appends search params from input to base', () => {
    assert.equal(resolve('?q=2', 'https://remix.run?q=1'), 'https://remix.run?q=1&q=2')
  })
})

// prettier-ignore
export type Tests = [
  // empty input/base
  Assert<IsEqual<Resolve<'', ''>, ''>>,
  Assert<IsEqual<Resolve<'', 'hello'>, 'hello'>>,
  Assert<IsEqual<Resolve<'hello', ''>, 'hello'>>,

  // input origin overrides base origin
  Assert<IsEqual<Resolve<'https://remix.run', 'http://example.com:8080'>, 'https://remix.run'>>,
  Assert<IsEqual<Resolve<'://remix.run', 'http://example.com:8080'>, '://remix.run'>>,
  Assert<IsEqual<Resolve<'://remix.run:8080', 'http://example.com'>, '://remix.run:8080'>>,

  // base origin used when input has none
  Assert<IsEqual<Resolve<'api', 'https://remix.run'>, 'https://remix.run/api'>>,
  Assert<IsEqual<Resolve<'api', 'https://remix.run:8080'>, 'https://remix.run:8080/api'>>,

  // absolute pathname resolution
  Assert<IsEqual<Resolve<'/hello', '/world'>, '/world/hello'>>,
  Assert<IsEqual<Resolve<'/hello', '/world/'>, '/world/hello'>>,

  // relative pathname resolution
  Assert<IsEqual<Resolve<'world', 'hello'>, 'hello/world'>>,
  Assert<IsEqual<Resolve<'world', 'hello/'>, 'hello/world'>>,

  // search params
  Assert<IsEqual<Resolve<'?q=1', 'https://remix.run'>, 'https://remix.run?q=1'>>,
  Assert<IsEqual<Resolve<'?q=2', 'https://remix.run?q=1'>, 'https://remix.run?q=1&q=2'>>,
]
