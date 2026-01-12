import * as assert from 'node:assert/strict'
import test, { describe } from 'node:test'
import { split, type SplitResult } from './split.ts'

function assertSplit(source: string, expected: Partial<SplitResult>) {
  expected.protocol = expected.protocol ?? null
  expected.hostname = expected.hostname ?? null
  expected.port = expected.port ?? null
  expected.pathname = expected.pathname ?? null
  expected.search = expected.search ?? null

  assert.deepStrictEqual(split(source), expected)
}

describe('split', () => {
  test('protocol', () => {
    assertSplit('http://', { protocol: [0, 4] })
  })

  test('hostname', () => {
    assertSplit('://example.com', { hostname: [3, 14] })
  })

  test('port', () => {
    assertSplit('://example.com:8000', { hostname: [3, 14], port: [15, 19] })
  })

  test('pathname', () => {
    assertSplit('pathname', { pathname: [0, 8] })
    assertSplit('/pathname', { pathname: [1, 9] })
    assertSplit('//pathname', { pathname: [1, 10] })
  })

  test('empty pathname', () => {
    assertSplit('/', { pathname: null })
    assertSplit('http:///', { protocol: [0, 4], pathname: null })
    assertSplit('://example/', { hostname: [3, 10], pathname: null })
  })

  test('search', () => {
    assertSplit('?q=1', { search: [1, 4] })
  })

  test('protocol + hostname', () => {
    assertSplit('http://example.com', { protocol: [0, 4], hostname: [7, 18] })
  })

  test('protocol + pathname', () => {
    assertSplit('http:///pathname', { protocol: [0, 4], pathname: [8, 16] })
  })

  test('hostname + pathname', () => {
    assertSplit('://example.com/pathname', { hostname: [3, 14], pathname: [15, 23] })
  })

  test('protocol + hostname + pathname', () => {
    assertSplit('http://example.com/pathname', {
      protocol: [0, 4],
      hostname: [7, 18],
      pathname: [19, 27],
    })
  })

  test('protocol + hostname + port + pathname + search', () => {
    assertSplit('http://example.com:8000/pathname?q=1', {
      protocol: [0, 4],
      hostname: [7, 18],
      port: [19, 23],
      pathname: [24, 32],
      search: [33, 36],
    })
  })

  test('/ before ://', () => {
    assertSplit('pathname/then://solidus', { pathname: [0, 23] })
    assertSplit('/pathname/then://solidus', { pathname: [1, 24] })
  })

  test('? before ://', () => {
    assertSplit('?search://solidus', { search: [1, 17] })
  })
  test('? before /', () => {
    assertSplit('?search/slash', { search: [1, 13] })
  })
})
