import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import type { SearchFunction } from './buffer-search.ts'
import { createSearch, createPartialTailSearch } from './buffer-search.ts'

function buf(string: string): Uint8Array {
  return new TextEncoder().encode(string)
}

function createFallbackSearch(pattern: string): SearchFunction {
  let buffer = Object.getOwnPropertyDescriptor(globalThis, 'Buffer')
  Object.defineProperty(globalThis, 'Buffer', { configurable: true, value: undefined })
  try {
    return createSearch(pattern)
  } finally {
    if (buffer) Object.defineProperty(globalThis, 'Buffer', buffer)
    else Reflect.deleteProperty(globalThis, 'Buffer')
  }
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

  it('uses the Buffer search on Bun', (t) => {
    let hasBun = 'Bun' in globalThis
    if (!hasBun) Object.defineProperty(globalThis, 'Bun', { configurable: true, value: {} })

    try {
      let indexOf = t.mock.method(Buffer.prototype, 'indexOf')
      let search = createSearch('world')

      assert.equal(search(buf('hello world world'), 7), 12)
      assert.equal(indexOf.mock.callCount(), 1)
    } finally {
      if (!hasBun) Reflect.deleteProperty(globalThis, 'Bun')
    }
  })

  it('scans fallback buffers with bounded byte access', () => {
    let pattern = 'baaaaaaa'
    let search = createFallbackSearch(pattern)

    let bytes = buf('a'.repeat(4096) + pattern)
    let reads = 0
    let haystack = new Proxy(bytes, {
      get(target, key) {
        if (typeof key === 'string' && /^\d+$/.test(key)) {
          assert.ok(++reads <= bytes.length * 4, 'unexpected number of buffer reads')
        }
        return Reflect.get(target, key, target)
      },
    })

    assert.equal(search(haystack), 4096)
    reads = 0
    assert.equal(search(haystack, 4097), -1)
    reads = 0
    bytes.fill(97)
    assert.equal(search(haystack), -1)
  })

  it('finds overlapping fallback matches from the requested offset', () => {
    let search = createFallbackSearch('abaaba')

    let haystack = buf('abaabaabaaba')
    assert.equal(search(haystack), 0)
    assert.equal(search(haystack, 1), 3)
    assert.equal(search(haystack, 4), 6)
    assert.equal(search(haystack, 7), -1)
    assert.equal(search(haystack, haystack.length), -1)
  })

  it('handles long fallback patterns without a match', () => {
    let search = createFallbackSearch('x'.repeat(258))
    assert.equal(search(buf('a'.repeat(512))), -1)
  })

  it('finds long fallback patterns after overlapping prefixes', () => {
    let pattern = 'x'.repeat(257) + 'y'
    let search = createFallbackSearch(pattern)
    assert.equal(search(buf('a'.repeat(10) + 'x' + pattern)), 11)
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
