import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

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

  it('handles long patterns whose length would wrap a byte-sized skip table', () => {
    let search = createSearch('x'.repeat(256))
    assert.equal(search(buf('a'.repeat(512))), -1)
  })

  it('finds a 256-byte pattern', () => {
    let pattern = 'x'.repeat(256)
    let search = createSearch(pattern)
    assert.equal(search(buf('a'.repeat(10) + pattern)), 10)
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
