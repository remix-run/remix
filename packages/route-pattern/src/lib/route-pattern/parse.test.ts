import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import dedent from 'dedent'

import { ParseError } from './parse.ts'

describe('ParseError', () => {
  it('exposes type, source, and index properties', () => {
    let error = new ParseError('unmatched (', 'foo(bar', 3)
    assert.equal(error.type, 'unmatched (')
    assert.equal(error.source, 'foo(bar')
    assert.equal(error.index, 3)
  })

  it('underlines the error indices', () => {
    let error = new ParseError('unmatched (', 'api/(v:major', 4)
    assert.equal(
      error.toString(),
      dedent`
        ParseError: unmatched (

        api/(v:major
            ^
      `,
    )
  })
})
