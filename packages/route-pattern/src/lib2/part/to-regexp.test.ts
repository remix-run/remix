import { describe, expect, it } from 'vitest'

import { parse } from './parse.ts'
import { toRegExp } from './to-regexp.ts'

describe('toRegExp', () => {
  it('converts an AST to a regular expression', () => {
    let source = 'api/(v:major(.:minor)/)run'
    let ast = parse(source)
    let paramValueRE = /[^/]+/
    let result = toRegExp(ast, paramValueRE)

    // The regex should match the full pattern
    expect('api/v1.2/run').toMatch(result)
    expect('api/v1/run').toMatch(result)
    expect('api/run').toMatch(result)

    // Should not match patterns that don't fit
    expect('api/').not.toMatch(result)
    expect('api/v1.2/walk').not.toMatch(result)
  })

  it('handles static text', () => {
    let source = 'hello/world'
    let ast = parse(source)
    let paramValueRE = /[^/]+/
    let result = toRegExp(ast, paramValueRE)

    expect('hello/world').toMatch(result)
    expect('hello/there').not.toMatch(result)
  })

  it('handles parameters', () => {
    let source = 'users/:id'
    let ast = parse(source)
    let paramValueRE = /[^/]+/
    let result = toRegExp(ast, paramValueRE)

    expect('users/123').toMatch(result)
    expect('users/abc').toMatch(result)
    expect('users/').not.toMatch(result)
    expect('users/123/posts').not.toMatch(result)
  })

  it('handles wildcards', () => {
    let source = 'files/*'
    let ast = parse(source)
    let paramValueRE = /[^/]+/
    let result = toRegExp(ast, paramValueRE)

    expect('files/anything').toMatch(result)
    expect('files/path/to/file').toMatch(result)
    expect('files/').toMatch(result)
  })

  it('escapes special regex characters in static text', () => {
    let source = 'api/v1.0/users/:id/(notes)'
    let ast = parse(source)
    let paramValueRE = /[^/]+/
    let result = toRegExp(ast, paramValueRE)

    // The literal '.' and parentheses should be escaped
    expect('api/v1.0/users/123/notes').toMatch(result)
    expect('api/v1.0/users/123/').toMatch(result)
    expect('api/v1X0/users/123/notes').not.toMatch(result) // '.' shouldn't match any char
  })
})
