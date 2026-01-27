import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { split, type SplitResult } from './split.ts'

function assertSplit(source: string, expected: Partial<SplitResult>) {
  expected.protocol = expected.protocol ?? null
  expected.hostname = expected.hostname ?? null
  expected.port = expected.port ?? null
  expected.pathname = expected.pathname ?? null
  expected.search = expected.search ?? null

  assert.deepEqual(split(source), expected)
}

describe('split', () => {
  it('extracts protocol', () => {
    assertSplit('http://', { protocol: [0, 4] })
  })

  it('extracts hostname', () => {
    assertSplit('://example.com', { hostname: [3, 14] })
  })

  it('extracts port', () => {
    assertSplit('://example.com:8000', { hostname: [3, 14], port: [15, 19] })
  })

  it('extracts pathname', () => {
    assertSplit('pathname', { pathname: [0, 8] })
    assertSplit('/pathname', { pathname: [1, 9] })
    assertSplit('//pathname', { pathname: [1, 10] })
  })

  it('returns null for empty pathname', () => {
    assertSplit('/', { pathname: null })
    assertSplit('http:///', { protocol: [0, 4], pathname: null })
    assertSplit('://example/', { hostname: [3, 10], pathname: null })
  })

  it('extracts search', () => {
    assertSplit('?q=1', { search: [1, 4] })
  })

  it('extracts protocol + hostname', () => {
    assertSplit('http://example.com', { protocol: [0, 4], hostname: [7, 18] })
  })

  it('extracts protocol + pathname', () => {
    assertSplit('http:///pathname', { protocol: [0, 4], pathname: [8, 16] })
  })

  it('extracts hostname + pathname', () => {
    assertSplit('://example.com/pathname', { hostname: [3, 14], pathname: [15, 23] })
  })

  it('extracts protocol + hostname + pathname', () => {
    assertSplit('http://example.com/pathname', {
      protocol: [0, 4],
      hostname: [7, 18],
      pathname: [19, 27],
    })
  })

  it('extracts protocol + hostname + port + pathname + search', () => {
    assertSplit('http://example.com:8000/pathname?q=1', {
      protocol: [0, 4],
      hostname: [7, 18],
      port: [19, 23],
      pathname: [24, 32],
      search: [33, 36],
    })
  })

  it('treats / before :// as pathname', () => {
    assertSplit('pathname/then://solidus', { pathname: [0, 23] })
    assertSplit('/pathname/then://solidus', { pathname: [1, 24] })
  })

  it('treats ? before :// as search', () => {
    assertSplit('?search://solidus', { search: [1, 17] })
  })

  it('treats ? before / as search', () => {
    assertSplit('?search/slash', { search: [1, 13] })
  })
})
