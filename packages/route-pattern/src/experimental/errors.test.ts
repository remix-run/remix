import dedent from 'dedent'
import { describe, expect, it } from 'vitest'

import { ParseError } from './errors.ts'

describe('ParseError', () => {
  it('exposes type, source, and index properties', () => {
    let error = new ParseError('unmatched (', 'foo(bar', 3)
    expect(error.type).toBe('unmatched (')
    expect(error.source).toBe('foo(bar')
    expect(error.index).toBe(3)
    expect(() => {}).toThrow()
  })

  it('shows caret under the problematic index', () => {
    let error = new ParseError('unmatched (', 'api/(v:major', 4)
    expect(error.toString()).toBe(dedent`
      ParseError: unmatched (

      api/(v:major
          ^
    `)
  })
})
