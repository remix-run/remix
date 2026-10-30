import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { getActivationLine, getActiveHeadingIndex } from './public/table-of-contents-active.ts'

describe('getActiveHeadingIndex', () => {
  it('selects the first heading before any heading crosses the activation line', () => {
    assert.equal(getActiveHeadingIndex([180, 420, 760], 116, false), 0)
  })

  it('selects the last heading that crossed the activation line', () => {
    assert.equal(getActiveHeadingIndex([-200, 80, 360], 116, false), 1)
  })

  it('selects the final heading at the end of the document', () => {
    assert.equal(getActiveHeadingIndex([-600, -240, 300], 116, true), 2)
  })

  it('returns -1 when there are no headings', () => {
    assert.equal(getActiveHeadingIndex([], 116, false), -1)
  })
})

describe('getActivationLine', () => {
  it('adds part of the viewport below the header', () => {
    assert.equal(getActivationLine(800, true), 236)
    assert.equal(getActivationLine(600, false), 178)
  })

  it('caps the extra distance on tall viewports', () => {
    assert.equal(getActivationLine(2000, true), 276)
  })
})
