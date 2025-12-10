import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { parse } from './parse.ts'
import { toRegExp } from './to-regexp.ts'

describe('toRegExp', () => {
  it('converts an AST to a regular expression', () => {
    let source = 'api/(v:major(.:minor)/)run'
    let ast = parse(source)
    let paramValueRE = /[^/]+/
    let result = toRegExp(ast, paramValueRE)

    // The regex should match the full pattern
    assert.match('api/v1.2/run', result)
    assert.match('api/v1/run', result)
    assert.match('api/run', result)

    // Should not match patterns that don't fit
    assert.doesNotMatch('api/', result)
    assert.doesNotMatch('api/v1.2/walk', result)
  })

  it('handles static text', () => {
    let source = 'hello/world'
    let ast = parse(source)
    let paramValueRE = /[^/]+/
    let result = toRegExp(ast, paramValueRE)

    assert.match('hello/world', result)
    assert.doesNotMatch('hello/there', result)
  })

  it('handles parameters', () => {
    let source = 'users/:id'
    let ast = parse(source)
    let paramValueRE = /[^/]+/
    let result = toRegExp(ast, paramValueRE)

    assert.match('users/123', result)
    assert.match('users/abc', result)
    assert.doesNotMatch('users/', result)
    assert.doesNotMatch('users/123/posts', result)
  })

  it('handles wildcards', () => {
    let source = 'files/*'
    let ast = parse(source)
    let paramValueRE = /[^/]+/
    let result = toRegExp(ast, paramValueRE)

    assert.match('files/anything', result)
    assert.match('files/path/to/file', result)
    assert.match('files/', result)
  })

  it('escapes special regex characters in static text', () => {
    let source = 'api/v1.0/users/:id/(notes)'
    let ast = parse(source)
    let paramValueRE = /[^/]+/
    let result = toRegExp(ast, paramValueRE)

    // The literal '.' and parentheses should be escaped
    assert.match('api/v1.0/users/123/notes', result)
    assert.match('api/v1.0/users/123/', result)
    assert.doesNotMatch('api/v1X0/users/123/notes', result) // '.' shouldn't match any char
  })
})
