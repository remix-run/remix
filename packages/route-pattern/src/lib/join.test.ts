import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { Assert, IsEqual } from './type-utils'
import { join } from './join.ts'
import type { Join } from './join.ts'
import { parse } from './parse.ts'

function joinStrings(a: string, b: string): string {
  return join(parse(a), parse(b))
}

describe('join', () => {
  it('joins empty input and base', () => {
    assert.equal(joinStrings('', ''), '/')
  })

  it('joins two slashes', () => {
    assert.equal(joinStrings('/', '/'), '/')
  })

  it('joins empty input', () => {
    assert.equal(joinStrings('hello', ''), '/hello')
  })

  it('joins empty base', () => {
    assert.equal(joinStrings('', 'hello'), '/hello')
  })

  it('uses protocol, hostname, and port from input when present', () => {
    assert.equal(joinStrings('http://example.com:8080', 'https://remix.run'), 'https://remix.run/')
    assert.equal(joinStrings('http://example.com:8080', '://remix.run'), '://remix.run/')
    assert.equal(joinStrings('http://example.com', '://remix.run:8080'), '://remix.run:8080/')
  })

  it('uses protocol, hostname, and port from base when none is provided in input', () => {
    assert.equal(joinStrings('https://remix.run', 'api'), 'https://remix.run/api')
    assert.equal(joinStrings('https://remix.run/', 'api'), 'https://remix.run/api')
    assert.equal(joinStrings('https://remix.run:8080', 'api'), 'https://remix.run:8080/api')
    assert.equal(joinStrings('https://remix.run:8080/', 'api'), 'https://remix.run:8080/api')
  })

  it('joins input with the root pathname', () => {
    assert.equal(joinStrings('/', 'hello'), '/hello')
    assert.equal(joinStrings('/', '/hello'), '/hello')
  })

  it('joins root input with an existing pathname', () => {
    assert.equal(joinStrings('hello', '/'), '/hello')
    assert.equal(joinStrings('/hello', '/'), '/hello')
  })

  it('joins input with absolute pathname', () => {
    assert.equal(joinStrings('hello', '/world'), '/hello/world')
    assert.equal(joinStrings('hello/', '/world'), '/hello/world')
    assert.equal(joinStrings('/hello', '/world'), '/hello/world')
    assert.equal(joinStrings('/hello/', '/world'), '/hello/world')
  })

  it('joins input with relative pathname', () => {
    assert.equal(joinStrings('hello', 'world'), '/hello/world')
    assert.equal(joinStrings('hello/', 'world'), '/hello/world')
    assert.equal(joinStrings('/hello', 'world'), '/hello/world')
    assert.equal(joinStrings('/hello/', 'world'), '/hello/world')
  })

  it('joins input with optional pathname', () => {
    assert.equal(joinStrings('', '(/:lang)/world'), '(/:lang)/world')
    assert.equal(joinStrings('/', '(/:lang)/world'), '(/:lang)/world')
    assert.equal(joinStrings('hello', '(/:lang)/world'), '/hello(/:lang)/world')
    assert.equal(joinStrings('hello/', '(/:lang)/world'), '/hello(/:lang)/world')
  })

  it('joins input with search params', () => {
    assert.equal(joinStrings('https://remix.run', '?q=1'), 'https://remix.run/?q=1')
  })

  it('appends search params from input to base', () => {
    assert.equal(joinStrings('https://remix.run?q=1', '?q=2'), 'https://remix.run/?q=1&q=2')
  })
})

// prettier-ignore
export type Tests = [
  // empty input/base
  Assert<IsEqual<Join<'', ''>, ''>>,
  Assert<IsEqual<Join<'/', '/'>, '/'>>,
  Assert<IsEqual<Join<'hello', ''>, 'hello'>>,
  Assert<IsEqual<Join<'', 'hello'>, 'hello'>>,

  // input origin overrides base origin
  Assert<IsEqual<Join<'http://example.com:8080', 'https://remix.run'>, 'https://remix.run/'>>,
  Assert<IsEqual<Join<'http://example.com:8080', '://remix.run'>, '://remix.run/'>>,
  Assert<IsEqual<Join<'http://example.com', '://remix.run:8080'>, '://remix.run:8080/'>>,

  // base origin used when input has none
  Assert<IsEqual<Join<'https://remix.run', 'api'>, 'https://remix.run/api'>>,
  Assert<IsEqual<Join<'https://remix.run/', 'api'>, 'https://remix.run/api'>>,
  Assert<IsEqual<Join<'https://remix.run:8080', 'api'>, 'https://remix.run:8080/api'>>,
  Assert<IsEqual<Join<'https://remix.run:8080/', 'api'>, 'https://remix.run:8080/api'>>,

  // root pathname join
  Assert<IsEqual<Join<'/', 'hello'>, '/hello'>>,
  Assert<IsEqual<Join<'/', '/hello'>, '/hello'>>,

  // root input with existing pathname
  Assert<IsEqual<Join<'hello', '/'>, 'hello'>>,
  Assert<IsEqual<Join<'/hello', '/'>, '/hello'>>,

  // absolute pathname join
  Assert<IsEqual<Join<'hello', '/world'>, '/hello/world'>>,
  Assert<IsEqual<Join<'/hello', '/world'>, '/hello/world'>>,
  Assert<IsEqual<Join<'hello/', '/world'>, '/hello/world'>>,
  Assert<IsEqual<Join<'/hello/', '/world'>, '/hello/world'>>,

  // relative pathname join
  Assert<IsEqual<Join<'hello', 'world'>, '/hello/world'>>,
  Assert<IsEqual<Join<'/hello', 'world'>, '/hello/world'>>,
  Assert<IsEqual<Join<'hello/', 'world'>, '/hello/world'>>,
  Assert<IsEqual<Join<'/hello/', 'world'>, '/hello/world'>>,

  // optional pathname join
  Assert<IsEqual<Join<'', '(/:lang)/world'>, '(/:lang)/world'>>,
  Assert<IsEqual<Join<'/', '(/:lang)/world'>, '(/:lang)/world'>>,
  Assert<IsEqual<Join<'hello', '(/:lang)/world'>, '/hello(/:lang)/world'>>,
  Assert<IsEqual<Join<'hello/', '(/:lang)/world'>, '/hello(/:lang)/world'>>,

  // search params
  Assert<IsEqual<Join<'https://remix.run', '?q=1'>, 'https://remix.run/?q=1'>>,
  Assert<IsEqual<Join<'https://remix.run?q=1', '?q=2'>, 'https://remix.run/?q=1&q=2'>>,
]
