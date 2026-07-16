import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { addHeadingIds, readMarkdownSectionsFromRoot } from './headings.ts'
import { parseMarkdownRoot } from './parser.ts'

function sectionsFrom(source: string) {
  let root = parseMarkdownRoot(source)
  addHeadingIds(root)
  return readMarkdownSectionsFromRoot(root)
}

describe('addHeadingIds / readMarkdownSectionsFromRoot', () => {
  it('only collects h2 headings as sections', () => {
    let sections = sectionsFrom('# H1\n\n## H2 one\n\n### H3\n\n## H2 two\n')
    assert.equal(sections.length, 2)
    assert.equal(sections[0].title, 'H2 one')
    assert.equal(sections[1].title, 'H2 two')
  })

  it('slugifies section ids from heading text', () => {
    let sections = sectionsFrom('## Rendering UI {#rendering-ui}\n\n## Data and Validation\n')
    assert.equal(sections[0].id, 'rendering-ui')
    assert.equal(sections[1].id, 'data-and-validation')
  })

  it('prefers an explicit {#id} over the slugified text', () => {
    let sections = sectionsFrom('## Custom Title {#custom-id}\n')
    assert.equal(sections[0].id, 'custom-id')
    assert.equal(sections[0].title, 'Custom Title')
  })

  it('strips the explicit id marker from the rendered title', () => {
    let sections = sectionsFrom('## Title {#keep-this}\n')
    assert.equal(sections[0].title, 'Title')
  })

  it('disambiguates duplicate heading slugs', () => {
    let sections = sectionsFrom('## Overview\n\n## Overview\n')
    assert.equal(sections[0].id, 'overview')
    assert.equal(sections[1].id, 'overview-1')
  })

  it('falls back to the section id for an empty heading', () => {
    let sections = sectionsFrom('## \n')
    assert.equal(sections[0].id, 'section')
  })

  it('renders inline markdown in section titleHtml', () => {
    let sections = sectionsFrom('## `code` and *em*\n')
    assert.equal(sections[0].title, 'code and em')
    assert.equal(sections[0].titleHtml, '<code>code</code> and <em>em</em>')
  })
})
