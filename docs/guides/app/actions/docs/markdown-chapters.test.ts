import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { loadDocsChapterSummaries, parseChapterFilename } from './markdown-chapters.tsx'

describe('loadDocsChapterSummaries', () => {
  it('retains numeric chapter order for presentation-specific labels', async () => {
    let summaries = await loadDocsChapterSummaries()

    assert.equal(summaries[0]?.order, 1)
    assert.equal(summaries[0]?.chapter, 'Chapter 1')
    assert.equal(summaries[9]?.order, 10)
    assert.equal(summaries[9]?.chapter, 'Chapter 10')
  })
})

describe('parseChapterFilename', () => {
  it('parses an order prefix and slug', () => {
    assert.deepEqual(parseChapterFilename('01-start-here.md'), { order: 1, slug: 'start-here' })
    assert.deepEqual(parseChapterFilename('10-files-and-assets.md'), {
      order: 10,
      slug: 'files-and-assets',
    })
  })

  it('parses a numeric slug segment', () => {
    assert.deepEqual(parseChapterFilename('17-markdown-style-demo.md'), {
      order: 17,
      slug: 'markdown-style-demo',
    })
  })

  it('rejects a missing .md extension', () => {
    assert.equal(parseChapterFilename('01-start-here'), undefined)
  })

  it('rejects a file without an order prefix', () => {
    assert.equal(parseChapterFilename('start-here.md'), undefined)
  })

  it('rejects a zero order prefix', () => {
    assert.equal(parseChapterFilename('00-intro.md'), undefined)
  })

  it('rejects an uppercase slug', () => {
    assert.equal(parseChapterFilename('01-StartHere.md'), undefined)
  })

  it('rejects a non-markdown file', () => {
    assert.equal(parseChapterFilename('README.txt'), undefined)
  })
})
