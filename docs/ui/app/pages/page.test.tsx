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

  it('includes API parts without listing individual fields or full argument lists', () => {
    let headings = readPageHeadings(
      <Section id="api-reference" title="API reference">
        <h3 id="context-reference">Context</h3>
        <h4>Provided state</h4>
        <h3 id="trigger-reference">
          <code>trigger(options?)</code>
        </h3>
        <h3 id="events-reference">onChange(handler, captureBoolean?)</h3>
        <h3>Not linked</h3>
        <h3 id="types-reference">Types &amp; definitions</h3>
      </Section>,
    )
    assert.deepEqual(headings, [
      { id: 'api-reference', title: 'API reference', titleHtml: 'API reference', depth: 2 },
      { id: 'context-reference', title: 'Context', titleHtml: 'Context', depth: 3 },
      { id: 'trigger-reference', title: 'trigger()', titleHtml: 'trigger()', depth: 3 },
      { id: 'events-reference', title: 'onChange()', titleHtml: 'onChange()', depth: 3 },
      {
        id: 'types-reference',
        title: 'Types & definitions',
        titleHtml: 'Types &amp; definitions',
        depth: 3,
      },
    ])
    assert.throws(
      () =>
        readPageHeadings(
          <Section id="context" title="Context">
            <h3 id="context">Context</h3>
          </Section>,
        ),
      /Duplicate docs ID: context/,
    )
  })
})
