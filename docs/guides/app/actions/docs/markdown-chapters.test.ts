import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import {
  loadDocsChapterSummaries,
  loadDocsIndexChapterSummaries,
  loadDocsNavigationItems,
  parseChapterFilename,
} from './markdown-chapters.tsx'

describe('loadDocsChapterSummaries', () => {
  it('retains numeric chapter order for presentation-specific labels', async () => {
    let summaries = await loadDocsChapterSummaries()

    assert.equal(summaries[0]?.order, 1)
    assert.equal(summaries[0]?.chapter, 'Chapter 1')
    assert.equal(summaries[9]?.order, 10)
    assert.equal(summaries[9]?.chapter, 'Chapter 10')
  })

  it('publishes unfinished chapters but omits the development fixture', async () => {
    let developmentSummaries = await loadDocsChapterSummaries('development')
    let productionSummaries = await loadDocsChapterSummaries('production')

    assert.deepEqual(
      developmentSummaries
        .filter((summary) => summary.order >= 8 && summary.order <= 16)
        .map((summary) => summary.order),
      [8, 9, 10, 11, 12, 13, 14, 15, 16],
    )
    assert.deepEqual(
      productionSummaries
        .filter((summary) => summary.order >= 8 && summary.order <= 16)
        .map((summary) => summary.order),
      [8, 9, 10, 11, 12, 13, 14, 15],
    )
  })
})

describe('loadDocsIndexChapterSummaries', () => {
  it('lists unfinished production chapters as enabled without listing fixtures', async () => {
    let summaries = await loadDocsIndexChapterSummaries('production')

    assert.deepEqual(
      summaries
        .filter((chapter) => chapter.order >= 8)
        .map((chapter) => ({ order: chapter.order, disabled: chapter.disabled })),
      [
        { order: 8, disabled: false },
        { order: 9, disabled: false },
        { order: 10, disabled: false },
        { order: 11, disabled: false },
        { order: 12, disabled: false },
        { order: 13, disabled: false },
        { order: 14, disabled: false },
        { order: 15, disabled: false },
      ],
    )
  })
})

describe('loadDocsNavigationItems', () => {
  it('links to unfinished production chapters without listing fixtures', async () => {
    let navigation = await loadDocsNavigationItems('production')

    assert.deepEqual(
      navigation
        .filter((chapter) => chapter.order >= 8)
        .map((chapter) => ({ order: chapter.order, disabled: chapter.disabled })),
      [
        { order: 8, disabled: false },
        { order: 9, disabled: false },
        { order: 10, disabled: false },
        { order: 11, disabled: false },
        { order: 12, disabled: false },
        { order: 13, disabled: false },
        { order: 14, disabled: false },
        { order: 15, disabled: false },
      ],
    )
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
    assert.deepEqual(parseChapterFilename('16-markdown-style-demo.md'), {
      order: 16,
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
