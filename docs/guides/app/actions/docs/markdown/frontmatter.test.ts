import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { readChapterMetadata } from './frontmatter.ts'

const options = { chapter: 'Chapter 1', filePath: '/path/to/01-start-here.md' }

describe('readChapterMetadata', () => {
  it('reads title, description, and chapter from frontmatter attributes', () => {
    assert.deepEqual(
      readChapterMetadata({ title: 'Start Here', description: 'An intro to Remix.' }, options),
      {
        chapter: 'Chapter 1',
        title: 'Start Here',
        description: 'An intro to Remix.',
        published: true,
        listed: true,
      },
    )
  })

  it('reads an unpublished marker', () => {
    assert.deepEqual(
      readChapterMetadata(
        {
          title: 'Markdown Style Demo',
          description: 'A rendering fixture.',
          published: false,
        },
        options,
      ),
      {
        chapter: 'Chapter 1',
        title: 'Markdown Style Demo',
        description: 'A rendering fixture.',
        published: false,
        listed: true,
      },
    )
  })

  it('reads an unlisted marker', () => {
    assert.deepEqual(
      readChapterMetadata(
        {
          title: 'Markdown Style Demo',
          description: 'A rendering fixture.',
          published: false,
          listed: false,
        },
        options,
      ),
      {
        chapter: 'Chapter 1',
        title: 'Markdown Style Demo',
        description: 'A rendering fixture.',
        published: false,
        listed: false,
      },
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

  it('throws when published is not a boolean', () => {
    assert.throws(
      () => readChapterMetadata({ title: 'ok', description: 'ok', published: 'yes' }, options),
      /Expected `published` to be a boolean/,
    )
  })

  it('throws when listed is not a boolean', () => {
    assert.throws(
      () => readChapterMetadata({ title: 'ok', description: 'ok', listed: 'yes' }, options),
      /Expected `listed` to be a boolean/,
    )
  })

  it('falls back to a generic location when filePath is absent', () => {
    assert.throws(
      () => readChapterMetadata({}, { chapter: 'Chapter 1' }),
      /Markdown:1: Invalid frontmatter/,
    )
  })
})
