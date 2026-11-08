import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { getClientEntryKey } from '../runtime/client-entry-boundary.ts'

describe('getClientEntryKey', () => {
  it('ignores a single 13-digit HMR timestamp query parameter', () => {
    let stableKey = getClientEntryKey({ moduleUrl: '/entry.js', exportName: 'Entry' })

    expect(
      getClientEntryKey({
        moduleUrl: '/entry.js?t=1234567890123',
        exportName: 'Entry',
      }),
    ).toBe(stableKey)
    expect(
      getClientEntryKey({
        moduleUrl: '/entry.js?t=2234567890123',
        exportName: 'Entry',
      }),
    ).toBe(stableKey)
  })

  it('ignores the HMR timestamp in any query parameter position', () => {
    let stableKey = getClientEntryKey({
      moduleUrl: '/entry.js?import&mode=compact#view',
      exportName: 'Entry',
    })

    expect(
      getClientEntryKey({
        moduleUrl: '/entry.js?t=1234567890123&import&mode=compact#view',
        exportName: 'Entry',
      }),
    ).toBe(stableKey)
    expect(
      getClientEntryKey({
        moduleUrl: '/entry.js?import&t=1234567890123&mode=compact#view',
        exportName: 'Entry',
      }),
    ).toBe(stableKey)
    expect(
      getClientEntryKey({
        moduleUrl: '/entry.js?import&mode=compact&t=1234567890123#view',
        exportName: 'Entry',
      }),
    ).toBe(stableKey)
  })

  it('preserves empty query segments around the HMR timestamp', () => {
    let emptyQueryKey = getClientEntryKey({ moduleUrl: '/entry.js?', exportName: 'Entry' })
    let leadingEmptySegmentKey = getClientEntryKey({
      moduleUrl: '/entry.js?&import',
      exportName: 'Entry',
    })
    let trailingEmptySegmentKey = getClientEntryKey({
      moduleUrl: '/entry.js?import&',
      exportName: 'Entry',
    })
    let twoEmptySegmentsKey = getClientEntryKey({ moduleUrl: '/entry.js?&', exportName: 'Entry' })

    expect(
      getClientEntryKey({ moduleUrl: '/entry.js?&t=1234567890123', exportName: 'Entry' }),
    ).toBe(emptyQueryKey)
    expect(
      getClientEntryKey({ moduleUrl: '/entry.js?t=1234567890123&', exportName: 'Entry' }),
    ).toBe(emptyQueryKey)
    expect(
      getClientEntryKey({
        moduleUrl: '/entry.js?&import&t=1234567890123',
        exportName: 'Entry',
      }),
    ).toBe(leadingEmptySegmentKey)
    expect(
      getClientEntryKey({
        moduleUrl: '/entry.js?t=1234567890123&&import',
        exportName: 'Entry',
      }),
    ).toBe(leadingEmptySegmentKey)
    expect(
      getClientEntryKey({
        moduleUrl: '/entry.js?import&t=1234567890123&',
        exportName: 'Entry',
      }),
    ).toBe(trailingEmptySegmentKey)
    expect(
      getClientEntryKey({
        moduleUrl: '/entry.js?t=1234567890123&&',
        exportName: 'Entry',
      }),
    ).toBe(twoEmptySegmentsKey)
    expect(
      getClientEntryKey({
        moduleUrl: '/entry.js?&t=1234567890123&',
        exportName: 'Entry',
      }),
    ).toBe(twoEmptySegmentsKey)
    expect(
      getClientEntryKey({
        moduleUrl: '/entry.js?&&t=1234567890123',
        exportName: 'Entry',
      }),
    ).toBe(twoEmptySegmentsKey)
  })

  it('normalizes an inserted HMR timestamp without changing any raw query segments', () => {
    let timestampSegment = 't=1234567890123'
    let segmentValues = ['', 'import', 'mode=compact', 'value=a%26b']
    let urlBases = [
      '/entry.js',
      'entry.js',
      '../entry.js',
      '//cdn.example.com/entry.js',
      'https://user@example.com:8443/assets/entry.js',
      '/entry%3Fvariant.js',
    ]
    let hashes = ['', '#', '#view', '#view?t=2234567890123&import']
    let querySegmentSets: string[][] = [[]]
    let querySegmentFrontier: string[][] = [[]]

    for (let length = 1; length <= 4; length++) {
      let nextSets: string[][] = []
      for (let querySegments of querySegmentFrontier) {
        for (let segment of segmentValues) {
          nextSets.push([...querySegments, segment])
        }
      }
      querySegmentSets.push(...nextSets)
      querySegmentFrontier = nextSets
    }

    for (let urlBase of urlBases) {
      for (let hash of hashes) {
        for (let querySegments of querySegmentSets) {
          let stableUrl =
            querySegments.length === 0
              ? `${urlBase}${hash}`
              : `${urlBase}?${querySegments.join('&')}${hash}`
          let stableKey = getClientEntryKey({ moduleUrl: stableUrl, exportName: 'Entry' })

          for (let timestampIndex = 0; timestampIndex <= querySegments.length; timestampIndex++) {
            let timestampedSegments = [...querySegments]
            timestampedSegments.splice(timestampIndex, 0, timestampSegment)
            let timestampedUrl = `${urlBase}?${timestampedSegments.join('&')}${hash}`

            expect(getClientEntryKey({ moduleUrl: timestampedUrl, exportName: 'Entry' })).toBe(
              stableKey,
            )
          }
        }
      }
    }
  })

  it('does not collapse distinct empty query segment layouts', () => {
    let timestampedKey = getClientEntryKey({
      moduleUrl: '/entry.js?&import&t=1234567890123',
      exportName: 'Entry',
    })

    expect(getClientEntryKey({ moduleUrl: '/entry.js?import', exportName: 'Entry' })).not.toBe(
      timestampedKey,
    )
    expect(getClientEntryKey({ moduleUrl: '/entry.js?&&import', exportName: 'Entry' })).not.toBe(
      timestampedKey,
    )
  })

  it('does not ignore parameters that are not exact HMR timestamps', () => {
    let stableKey = getClientEntryKey({ moduleUrl: '/entry.js', exportName: 'Entry' })

    expect(
      getClientEntryKey({ moduleUrl: '/entry.js?t=123456789012', exportName: 'Entry' }),
    ).not.toBe(stableKey)
    expect(
      getClientEntryKey({ moduleUrl: '/entry.js?t=12345678901234', exportName: 'Entry' }),
    ).not.toBe(stableKey)
    expect(
      getClientEntryKey({ moduleUrl: '/entry.js?t=123456789012x', exportName: 'Entry' }),
    ).not.toBe(stableKey)
    expect(
      getClientEntryKey({ moduleUrl: '/entry.js?T=1234567890123', exportName: 'Entry' }),
    ).not.toBe(stableKey)
    expect(
      getClientEntryKey({ moduleUrl: '/entry.js?%74=1234567890123', exportName: 'Entry' }),
    ).not.toBe(stableKey)
    expect(
      getClientEntryKey({ moduleUrl: '/entry.js?t=%31123456789012', exportName: 'Entry' }),
    ).not.toBe(stableKey)
    expect(
      getClientEntryKey({ moduleUrl: '/entry.js?t=+123456789012', exportName: 'Entry' }),
    ).not.toBe(stableKey)
    expect(
      getClientEntryKey({ moduleUrl: '/entry.js?t=1234567890123=', exportName: 'Entry' }),
    ).not.toBe(stableKey)
    expect(
      getClientEntryKey({ moduleUrl: '/entry.js?value=t=1234567890123', exportName: 'Entry' }),
    ).not.toBe(stableKey)
    expect(
      getClientEntryKey({ moduleUrl: '/entry.js?t=1234567890123;import', exportName: 'Entry' }),
    ).not.toBe(stableKey)
  })

  it('does not ignore ambiguous duplicate HMR timestamps', () => {
    let stableKey = getClientEntryKey({ moduleUrl: '/entry.js', exportName: 'Entry' })

    expect(
      getClientEntryKey({
        moduleUrl: '/entry.js?t=1234567890123&import&t=2234567890123',
        exportName: 'Entry',
      }),
    ).not.toBe(stableKey)
  })

  it('preserves all other identity components exactly', () => {
    let key = getClientEntryKey({
      moduleUrl: '/entry.js?import&mode=compact&t=1234567890123#view',
      exportName: 'Entry',
    })

    expect(
      getClientEntryKey({
        moduleUrl: '/other.js?import&mode=compact&t=1234567890123#view',
        exportName: 'Entry',
      }),
    ).not.toBe(key)
    expect(
      getClientEntryKey({
        moduleUrl: '/entry.js?mode=compact&import&t=1234567890123#view',
        exportName: 'Entry',
      }),
    ).not.toBe(key)
    expect(
      getClientEntryKey({
        moduleUrl: '/entry.js?import&mode=expanded&t=1234567890123#view',
        exportName: 'Entry',
      }),
    ).not.toBe(key)
    expect(
      getClientEntryKey({
        moduleUrl: '/entry.js?import&mode=compact&t=1234567890123#other',
        exportName: 'Entry',
      }),
    ).not.toBe(key)
    expect(
      getClientEntryKey({
        moduleUrl: '/entry.js?import&mode=compact&t=1234567890123#view',
        exportName: 'Other',
      }),
    ).not.toBe(key)
  })

  it('keeps the module URL and export name as separate identity components', () => {
    let key = getClientEntryKey({
      moduleUrl: '/entry.js#view',
      exportName: 'Widget',
    })

    expect(
      getClientEntryKey({
        moduleUrl: '/entry.js',
        exportName: 'view#Widget',
      }),
    ).not.toBe(key)
  })
})
