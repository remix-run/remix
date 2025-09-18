import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { join } from './join.ts'
import type { Join } from './join.ts'
import type { Assert, IsEqual } from '../type-utils'

describe('join', () => {
  it('joins empty input and base', () => {
    assert.equal(join('', ''), '')
  })

  it('joins empty input', () => {
    assert.equal(join('hello', ''), 'hello')
  })

  it('joins empty base', () => {
    assert.equal(join('', 'hello'), 'hello')
  })

  it('uses protocol, hostname, and port from input when present', () => {
    assert.equal(join('http://example.com:8080', 'https://remix.run'), 'https://remix.run')
    assert.equal(join('http://example.com:8080', '://remix.run'), '://remix.run')
    assert.equal(join('http://example.com', '://remix.run:8080'), '://remix.run:8080')
  })

  it('uses protocol, hostname, and port from base when none is provided in input', () => {
    assert.equal(join('https://remix.run', 'api'), 'https://remix.run/api')
    assert.equal(join('https://remix.run/', 'api'), 'https://remix.run/api')
    assert.equal(join('https://remix.run:8080', 'api'), 'https://remix.run:8080/api')
    assert.equal(join('https://remix.run:8080/', 'api'), 'https://remix.run:8080/api')
  })

  it('joins input against the root pathname', () => {
    assert.equal(join('/', 'hello'), '/hello')
    assert.equal(join('/', '/hello'), '/hello')
  })

  it('joins input with absolute pathname', () => {
    assert.equal(join('hello', '/world'), 'hello/world')
    assert.equal(join('hello/', '/world'), 'hello/world')
    assert.equal(join('/hello', '/world'), '/hello/world')
    assert.equal(join('/hello/', '/world'), '/hello/world')
  })

  it('joins input with relative pathname', () => {
    assert.equal(join('hello', 'world'), 'hello/world')
    assert.equal(join('hello/', 'world'), 'hello/world')
    assert.equal(join('/hello', 'world'), '/hello/world')
    assert.equal(join('/hello/', 'world'), '/hello/world')
  })

  it('joins input with search params', () => {
    assert.equal(join('https://remix.run', '?q=1'), 'https://remix.run?q=1')
  })

  it('appends search params from input to base', () => {
    assert.equal(join('https://remix.run?q=1', '?q=2'), 'https://remix.run?q=1&q=2')
  })
})

// prettier-ignore
export type Tests = [
  // empty input/base
  Assert<IsEqual<Join<'', ''>, ''>>,
  Assert<IsEqual<Join<'hello', ''>, 'hello'>>,
  Assert<IsEqual<Join<'', 'hello'>, 'hello'>>,

  // input origin overrides base origin
  Assert<IsEqual<Join<'http://example.com:8080', 'https://remix.run'>, 'https://remix.run'>>,
  Assert<IsEqual<Join<'http://example.com:8080', '://remix.run'>, '://remix.run'>>,
  Assert<IsEqual<Join<'http://example.com', '://remix.run:8080'>, '://remix.run:8080'>>,

  // base origin used when input has none
  Assert<IsEqual<Join<'https://remix.run', 'api'>, 'https://remix.run/api'>>,
  Assert<IsEqual<Join<'https://remix.run/', 'api'>, 'https://remix.run/api'>>,
  Assert<IsEqual<Join<'https://remix.run:8080', 'api'>, 'https://remix.run:8080/api'>>,
  Assert<IsEqual<Join<'https://remix.run:8080/', 'api'>, 'https://remix.run:8080/api'>>,

  // root pathname join
  Assert<IsEqual<Join<'/', 'hello'>, '/hello'>>,
  Assert<IsEqual<Join<'/', '/hello'>, '/hello'>>,

  // absolute pathname join
  Assert<IsEqual<Join<'hello', '/world'>, 'hello/world'>>,
  Assert<IsEqual<Join<'/hello', '/world'>, '/hello/world'>>,
  Assert<IsEqual<Join<'hello/', '/world'>, 'hello/world'>>,
  Assert<IsEqual<Join<'/hello/', '/world'>, '/hello/world'>>,

  // relative pathname join
  Assert<IsEqual<Join<'hello', 'world'>, 'hello/world'>>,
  Assert<IsEqual<Join<'/hello', 'world'>, '/hello/world'>>,
  Assert<IsEqual<Join<'hello/', 'world'>, 'hello/world'>>,
  Assert<IsEqual<Join<'/hello/', 'world'>, '/hello/world'>>,

  // search params
  Assert<IsEqual<Join<'https://remix.run', '?q=1'>, 'https://remix.run?q=1'>>,
  Assert<IsEqual<Join<'https://remix.run?q=1', '?q=2'>, 'https://remix.run?q=1&q=2'>>,
]
