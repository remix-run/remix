import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { getVersionsForPickerFromTags } from './versions.ts'

describe('getVersionsForPickerFromTags()', () => {
  it('returns stable Remix v3 tags sorted newest first', () => {
    let versions = getVersionsForPickerFromTags(
      `
      remix@2.16.8
      remix@3.0.0
      remix@3.2.0-beta.1
      remix@3.1.2
      other@3.3.0
    `,
      { fallback: ['0.0.0'] },
    )

    assert.deepEqual(versions, ['v3.1.2', 'v3.0.0'])
  })

  it('falls back when there are no stable Remix v3 tags', () => {
    let versions = getVersionsForPickerFromTags('remix@3.0.0-beta.1', {
      fallback: ['0.0.0'],
    })

    assert.deepEqual(versions, ['0.0.0'])
  })

  it('includes the active version when it has a matching prerelease tag', () => {
    let versions = getVersionsForPickerFromTags('remix@3.0.0-beta.1', {
      activeVersion: 'v3.0.0-beta.1',
      fallback: ['0.0.0'],
    })

    assert.deepEqual(versions, ['v3.0.0-beta.1'])
  })

  it('throws when the active version has no matching git tag', () => {
    assert.throws(
      () =>
        getVersionsForPickerFromTags('remix@3.0.0', {
          activeVersion: 'v3.1.2',
          fallback: ['0.0.0'],
        }),
      /No matching git tag found for --version v3\.1\.2 \(expected remix@3\.1\.2\)/,
    )
  })
})
