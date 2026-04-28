import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { toDiskSegment } from './controller-files.ts'

describe('controller file paths', () => {
  it('sanitizes path traversal and separators from disk segments', () => {
    assert.equal(toDiskSegment('../../../escape'), 'escape')
    assert.equal(toDiskSegment('nested/segment'), 'nested-segment')
    assert.equal(toDiskSegment('..'), 'route')
  })

  it('preserves the existing kebab-case mapping for camelCase route keys', () => {
    assert.equal(toDiskSegment('accountSettings'), 'account-settings')
  })
})
