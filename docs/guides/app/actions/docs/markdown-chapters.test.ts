import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import {
  loadDocsChapterSummaries,
  loadDocsIndexChapterSummaries,
  loadDocsNavigationItems,
  parseChapterFilename,
} from './markdown-chapters.tsx'

describe('loadDocsChapterSummaries', () => {
  it('sorts chapters numerically and labels them by order', async () => {
    let summaries = await loadDocsChapterSummaries('development')
    let orders = summaries.map((summary) => summary.order)

    assert.ok(orders.length > 1)
    assert.deepEqual(
      orders,
      [...orders].sort((a, b) => a - b),
    )
    assert.ok(summaries.every((summary) => summary.chapter === `Chapter ${summary.order}`))
  })

  it('excludes unpublished chapters in production', async () => {
    let developmentSummaries = await loadDocsChapterSummaries('development')
    let productionSummaries = await loadDocsChapterSummaries('production')

    assert.ok(developmentSummaries.some((summary) => summary.slug === 'markdown-style-demo'))
    assert.ok(!productionSummaries.some((summary) => summary.slug === 'markdown-style-demo'))
    assert.ok(productionSummaries.length > 0)
  })
})

describe('loadDocsIndexChapterSummaries', () => {
  it('omits unlisted chapters from the index and navigation', async () => {
    let summaries = await loadDocsIndexChapterSummaries('production')
    let navigation = await loadDocsNavigationItems('production')

    assert.ok(summaries.length > 0)
    assert.ok(!summaries.some((summary) => summary.slug === 'markdown-style-demo'))
    assert.deepEqual(
      navigation.map(({ slug, href, disabled }) => ({ slug, href, disabled })),
      summaries.map(({ slug, href, disabled }) => ({ slug, href, disabled })),
    )
  })
})

describe('parseChapterFilename', () => {
  it('parses an order prefix and slug', () => {
    assert.deepEqual(parseChapterFilename('01-intro.md'), { order: 1, slug: 'intro' })
    assert.deepEqual(parseChapterFilename('10-another-topic.md'), {
      order: 10,
      slug: 'another-topic',
    })
  })

  it('parses a numeric slug segment', () => {
    assert.deepEqual(parseChapterFilename('16-topic-2.md'), { order: 16, slug: 'topic-2' })
  })

  it('rejects a missing .md extension', () => {
    assert.equal(parseChapterFilename('01-intro'), undefined)
  })

  it('rejects a file without an order prefix', () => {
    assert.equal(parseChapterFilename('intro.md'), undefined)
  })

  it('rejects a zero order prefix', () => {
    assert.equal(parseChapterFilename('00-intro.md'), undefined)
  })

  it('rejects an uppercase slug', () => {
    assert.equal(parseChapterFilename('01-Intro.md'), undefined)
  })

  it('rejects a non-markdown file', () => {
    assert.equal(parseChapterFilename('README.txt'), undefined)
  })
})
