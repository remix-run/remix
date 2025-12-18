import { describe, expect, it } from 'vitest'

import * as Search from './search.ts'

describe('parse', () => {
  it('parses presence-only constraint', () => {
    expect(Search.parse('q')).toEqual(new Map([['q', null]]))
  })

  it('parses empty value constraint', () => {
    expect(Search.parse('q=')).toEqual(new Map([['q', new Set()]]))
  })

  it('parses single value constraint', () => {
    expect(Search.parse('q=hello')).toEqual(new Map([['q', new Set(['hello'])]]))
  })

  it('parses multiple values for same param', () => {
    expect(Search.parse('tag=a&tag=b&tag=c')).toEqual(new Map([['tag', new Set(['a', 'b', 'c'])]]))
  })

  it('parses multiple different params', () => {
    expect(Search.parse('a=1&b=2')).toEqual(
      new Map([
        ['a', new Set(['1'])],
        ['b', new Set(['2'])],
      ]),
    )
  })

  it('parses mixed constraint types', () => {
    expect(Search.parse('present&empty=&valued=x')).toEqual(
      new Map([
        ['present', null],
        ['empty', new Set()],
        ['valued', new Set(['x'])],
      ]),
    )
  })

  it('decodes URL-encoded param names and values', () => {
    expect(Search.parse('hello%20world=foo%26bar')).toEqual(
      new Map([['hello world', new Set(['foo&bar'])]]),
    )
  })

  it('presence constraint is not overwritten by later value', () => {
    expect(Search.parse('q&q=1')).toEqual(new Map([['q', new Set(['1'])]]))
  })

  it('skips empty params from consecutive ampersands', () => {
    expect(Search.parse('a=1&&b=2')).toEqual(
      new Map([
        ['a', new Set(['1'])],
        ['b', new Set(['2'])],
      ]),
    )
  })
})

describe('match', () => {
  it('matches presence-only constraint when param exists', () => {
    let constraints: Search.Constraints = new Map([['q', null]])
    expect(Search.match(new URLSearchParams('q'), constraints)).toBe(true)
    expect(Search.match(new URLSearchParams('q='), constraints)).toBe(true)
    expect(Search.match(new URLSearchParams('q=hello'), constraints)).toBe(true)
  })

  it('fails presence-only constraint when param is missing', () => {
    let constraints: Search.Constraints = new Map([['q', null]])
    expect(Search.match(new URLSearchParams(''), constraints)).toBe(false)
    expect(Search.match(new URLSearchParams('other=value'), constraints)).toBe(false)
  })

  it('matches empty value constraint when param has non-empty value', () => {
    let constraints: Search.Constraints = new Map([['q', new Set()]])
    expect(Search.match(new URLSearchParams('q=hello'), constraints)).toBe(true)
    expect(Search.match(new URLSearchParams('q=a&q=b'), constraints)).toBe(true)
  })

  it('fails empty value constraint when all values are empty', () => {
    let constraints: Search.Constraints = new Map([['q', new Set()]])
    expect(Search.match(new URLSearchParams('q='), constraints)).toBe(false)
    expect(Search.match(new URLSearchParams('q=&q='), constraints)).toBe(false)
  })

  it('matches specific value constraint when value is present', () => {
    let constraints: Search.Constraints = new Map([['q', new Set(['hello'])]])
    expect(Search.match(new URLSearchParams('q=hello'), constraints)).toBe(true)
    expect(Search.match(new URLSearchParams('q=hello&q=world'), constraints)).toBe(true)
  })

  it('fails specific value constraint when value is missing', () => {
    let constraints: Search.Constraints = new Map([['q', new Set(['hello'])]])
    expect(Search.match(new URLSearchParams('q=world'), constraints)).toBe(false)
    expect(Search.match(new URLSearchParams('q='), constraints)).toBe(false)
    expect(Search.match(new URLSearchParams(''), constraints)).toBe(false)
  })

  it('matches multiple value constraints when all values are present', () => {
    let constraints: Search.Constraints = new Map([['tag', new Set(['a', 'b'])]])
    expect(Search.match(new URLSearchParams('tag=a&tag=b'), constraints)).toBe(true)
    expect(Search.match(new URLSearchParams('tag=b&tag=a&tag=c'), constraints)).toBe(true)
  })

  it('fails multiple value constraints when some values are missing', () => {
    let constraints: Search.Constraints = new Map([['tag', new Set(['a', 'b'])]])
    expect(Search.match(new URLSearchParams('tag=a'), constraints)).toBe(false)
    expect(Search.match(new URLSearchParams('tag=b'), constraints)).toBe(false)
    expect(Search.match(new URLSearchParams('tag=c'), constraints)).toBe(false)
  })

  it('matches multiple different param constraints', () => {
    let constraints: Search.Constraints = new Map([
      ['a', new Set(['1'])],
      ['b', null],
    ])
    expect(Search.match(new URLSearchParams('a=1&b'), constraints)).toBe(true)
    expect(Search.match(new URLSearchParams('a=1&b=2'), constraints)).toBe(true)
  })

  it('fails when any constraint is not satisfied', () => {
    let constraints: Search.Constraints = new Map([
      ['a', new Set(['1'])],
      ['b', null],
    ])
    expect(Search.match(new URLSearchParams('a=1'), constraints)).toBe(false)
    expect(Search.match(new URLSearchParams('b=2'), constraints)).toBe(false)
  })

  it('matches with no constraints', () => {
    let constraints: Search.Constraints = new Map()
    expect(Search.match(new URLSearchParams(''), constraints)).toBe(true)
    expect(Search.match(new URLSearchParams('any=value'), constraints)).toBe(true)
  })
})

describe('join', () => {
  it('joins two empty constraints', () => {
    let a: Search.Constraints = new Map()
    let b: Search.Constraints = new Map()
    expect(Search.join(a, b)).toEqual(new Map())
  })

  it('joins with empty constraint on left', () => {
    let a: Search.Constraints = new Map()
    let b: Search.Constraints = new Map([['q', new Set(['1'])]])
    expect(Search.join(a, b)).toEqual(new Map([['q', new Set(['1'])]]))
  })

  it('joins with empty constraint on right', () => {
    let a: Search.Constraints = new Map([['q', new Set(['1'])]])
    let b: Search.Constraints = new Map()
    expect(Search.join(a, b)).toEqual(new Map([['q', new Set(['1'])]]))
  })

  it('joins disjoint constraints', () => {
    let a: Search.Constraints = new Map([['a', new Set(['1'])]])
    let b: Search.Constraints = new Map([['b', new Set(['2'])]])
    expect(Search.join(a, b)).toEqual(
      new Map([
        ['a', new Set(['1'])],
        ['b', new Set(['2'])],
      ]),
    )
  })

  it('merges values for same param', () => {
    let a: Search.Constraints = new Map([['q', new Set(['1'])]])
    let b: Search.Constraints = new Map([['q', new Set(['2'])]])
    expect(Search.join(a, b)).toEqual(new Map([['q', new Set(['1', '2'])]]))
  })

  it('presence constraint in a is overwritten by values in b', () => {
    let a: Search.Constraints = new Map([['q', null]])
    let b: Search.Constraints = new Map([['q', new Set(['1'])]])
    expect(Search.join(a, b)).toEqual(new Map([['q', new Set(['1'])]]))
  })

  it('values in a are preserved when b has presence constraint', () => {
    let a: Search.Constraints = new Map([['q', new Set(['1'])]])
    let b: Search.Constraints = new Map([['q', null]])
    expect(Search.join(a, b)).toEqual(new Map([['q', new Set(['1'])]]))
  })

  it('presence constraint in a is overwritten by presence in b', () => {
    let a: Search.Constraints = new Map([['q', null]])
    let b: Search.Constraints = new Map([['q', null]])
    expect(Search.join(a, b)).toEqual(new Map([['q', null]]))
  })

  it('does not mutate original constraints', () => {
    let a: Search.Constraints = new Map([['q', new Set(['1'])]])
    let b: Search.Constraints = new Map([['q', new Set(['2'])]])
    Search.join(a, b)
    expect(a).toEqual(new Map([['q', new Set(['1'])]]))
    expect(b).toEqual(new Map([['q', new Set(['2'])]]))
  })
})
