import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { Example } from './example.tsx'
import { readPageHeadings, Section } from './page.tsx'

const example = { Component: Empty, Preview: Empty, sourceHtml: '' }

function Empty() {
  return () => null
}

describe('UI page table of contents', () => {
  it('follows JSX order through sections, fragments and arrays', () => {
    let headings = readPageHeadings(
      <>
        <Example id="hero" example={example} hero />
        <Section id="state" title="State">
          <p>Choose how to manage state.</p>
          <>
            <Example id="uncontrolled" title="Uncontrolled" example={example} />
            <Example id="controlled" title="Controlled" example={example} />
          </>
        </Section>
        {[
          <Section id="keyboard" title="Keyboard & focus">
            Use arrow keys.
          </Section>,
        ]}
      </>,
    )
    assert.deepEqual(
      headings.map(({ id, depth }) => ({ id, depth })),
      [
        { id: 'state', depth: 2 },
        { id: 'uncontrolled', depth: 3 },
        { id: 'controlled', depth: 3 },
        { id: 'keyboard', depth: 2 },
      ],
    )
    assert.equal(headings.at(-1)?.titleHtml, 'Keyboard &amp; focus')
  })

  it('rejects duplicate section and example IDs', () => {
    assert.throws(
      () =>
        readPageHeadings(
          <Section id="state" title="State">
            <Example id="state" example={example} />
          </Section>,
        ),
      /Duplicate docs ID: state/,
    )
  })
})
