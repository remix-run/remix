import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createSearch, createPartialTailSearch } from './buffer-search.ts'

function buf(string: string): Uint8Array {
  return new TextEncoder().encode(string)
}

describe('createSearch', () => {
  it('finds the first occurrence of a pattern in a buffer', () => {
    let search = createSearch('world')
    assert.equal(search(buf('hello world')), 6)
  })

  it('returns -1 if the pattern is not found', () => {
    let search = createSearch('world')
    assert.equal(search(buf('hello worl')), -1)
  })
})

describe('createPartialTailSearch', () => {
  it('finds the last partial occurrence of a pattern in a buffer', () => {
    let search = createPartialTailSearch('world')
    assert.equal(search(buf('hello worl')), 6)
  })

  it('returns -1 if the pattern is not found at the end', () => {
    let search = createPartialTailSearch('world')
    assert.equal(search(buf('hello worlds')), -1)
  })
})
