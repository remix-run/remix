import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { groupMarkdownSections } from './sections.ts'

describe('groupMarkdownSections', () => {
  it('keeps content before the first section as intro', () => {
    let result = groupMarkdownSections(['p1', 'p2', 'h2:A', 'p3'], (node) => node.startsWith('h2'))

    assert.deepEqual(result.intro, ['p1', 'p2'])
    assert.deepEqual(result.sections, [['h2:A', 'p3']])
  })

  it('starts a new section at each section heading', () => {
    let result = groupMarkdownSections(['h2:A', 'p1', 'h3:B', 'h2:C', 'p2'], (node) =>
      node.startsWith('h2'),
    )

    assert.deepEqual(result.intro, [])
    assert.deepEqual(result.sections, [
      ['h2:A', 'p1', 'h3:B'],
      ['h2:C', 'p2'],
    ])
  })
})
