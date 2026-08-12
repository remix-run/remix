import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { readChapterMetadata } from './frontmatter.ts'

const options = { chapter: 'Chapter 1', filePath: '/path/to/01-start-here.md' }

describe('readChapterMetadata', () => {
  it('reads title, description, and chapter from frontmatter attributes', () => {
    assert.deepEqual(
      readChapterMetadata({ title: 'Start Here', description: 'An intro to Remix.' }, options),
      { chapter: 'Chapter 1', title: 'Start Here', description: 'An intro to Remix.' },
    )
  })

  it('throws when title is missing', () => {
    assert.throws(
      () => readChapterMetadata({ description: 'ok' }, options),
      /01-start-here\.md:1: Invalid frontmatter: Expected `title` to be a non-empty string/,
    )
  })

  it('throws when description is missing', () => {
    assert.throws(
      () => readChapterMetadata({ title: 'ok' }, options),
      /Expected `description` to be a non-empty string/,
    )
  })

  it('throws when a value is only whitespace', () => {
    assert.throws(
      () => readChapterMetadata({ title: '   ', description: 'ok' }, options),
      /Expected `title` to be a non-empty string/,
    )
  })

  it('throws when a value is a non-string type', () => {
    assert.throws(
      () => readChapterMetadata({ title: 42, description: 'ok' }, options),
      /Expected `title` to be a non-empty string/,
    )
  })

  it('falls back to a generic location when filePath is absent', () => {
    assert.throws(
      () => readChapterMetadata({}, { chapter: 'Chapter 1' }),
      /Markdown:1: Invalid frontmatter/,
    )
  })
})
