import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { Assert, IsEqual } from './type-utils'
import { parse } from './parse.ts'
import type { Parse } from './parse.ts'
import { stringify } from './stringify.ts'
import type { Stringify } from './stringify.ts'

describe('stringify', () => {
  it('stringifies parsed result', () => {
    assert.equal(stringify(parse('')), '/')
    assert.equal(stringify(parse('http')), '/http')
    assert.equal(stringify(parse('hello/world')), '/hello/world')
    assert.equal(stringify(parse('hello/world?q=1')), '/hello/world?q=1')
    assert.equal(stringify(parse('hello/world?q=1&q=2')), '/hello/world?q=1&q=2')
    assert.equal(stringify(parse('hello/world?q=1&a=2')), '/hello/world?q=1&a=2')

    assert.equal(stringify(parse('http://example.com')), 'http://example.com/')
    assert.equal(stringify(parse('https://example.com/path')), 'https://example.com/path')
    assert.equal(stringify(parse('https://example.com/path?q=1')), 'https://example.com/path?q=1')
    assert.equal(
      stringify(parse('https://example.com/path?q=1&q=2')),
      'https://example.com/path?q=1&q=2',
    )
    assert.equal(
      stringify(parse('https://example.com/path?q=1&a=2')),
      'https://example.com/path?q=1&a=2',
    )
    assert.equal(stringify(parse('/users/:id')), '/users/:id')
    assert.equal(stringify(parse('/files/*filepath')), '/files/*filepath')
  })
})

export type Tests = [
  Assert<IsEqual<Stringify<Parse<''>>, '/'>>,
  Assert<IsEqual<Stringify<Parse<'http'>>, '/http'>>,
  Assert<IsEqual<Stringify<Parse<'hello/world'>>, '/hello/world'>>,
  Assert<IsEqual<Stringify<Parse<'hello/world?q=1'>>, '/hello/world?q=1'>>,
  Assert<IsEqual<Stringify<Parse<'hello/world?q=1&q=2'>>, '/hello/world?q=1&q=2'>>,
  Assert<IsEqual<Stringify<Parse<'hello/world?q=1&a=2'>>, '/hello/world?q=1&a=2'>>,

  Assert<IsEqual<Stringify<Parse<'http://example.com'>>, 'http://example.com/'>>,
  Assert<IsEqual<Stringify<Parse<'https://example.com/path'>>, 'https://example.com/path'>>,
  Assert<IsEqual<Stringify<Parse<'https://example.com/path?q=1'>>, 'https://example.com/path?q=1'>>,
  Assert<
    IsEqual<
      Stringify<Parse<'https://example.com/path?q=1&q=2'>>,
      'https://example.com/path?q=1&q=2'
    >
  >,
  Assert<
    IsEqual<
      Stringify<Parse<'https://example.com/path?q=1&a=2'>>,
      'https://example.com/path?q=1&a=2'
    >
  >,
]
