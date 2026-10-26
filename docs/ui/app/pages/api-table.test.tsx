import * as assert from 'remix/assert'
import { renderToString } from 'remix/component/server'
import { describe, it } from 'remix/test'
import { ApiEntry, ApiTable } from './api-table.tsx'

describe('API references', () => {
  it('renders string metadata with rich content and a stable entry link', async () => {
    let html = await renderToString(
      <ApiTable id="options" label="Option" defaults>
        <ApiEntry name="duration" type="number" defaultValue="0" required>
          <p>
            Playback time in <strong>milliseconds</strong>.
          </p>
          <a href="#timing">Timing options</a>
          <pre>
            <code>duration: number</code>
          </pre>
        </ApiEntry>
      </ApiTable>,
    )

    assert.match(html, /<span>Option<\/span><span>Type<\/span><span>Default<\/span>/)
    assert.match(html, /<code>duration<\/code><span class="ui-api-required">Required<\/span>/)
    assert.match(html, /<span class="ui-api-type"><code>number<\/code><\/span>/)
    assert.match(html, /Default <\/span><code>0<\/code>/)
    assert.match(html, /id="options-duration" class="ui-api-entry-content"/)
    assert.match(html, /href="#options-duration" aria-label="Link to duration"/)
    assert.match(html, /<p>Playback time in <strong>milliseconds<\/strong>\.<\/p>/)
    assert.match(html, /<a href="#timing">Timing options<\/a>/)
    assert.match(html, /<pre><code>duration: number<\/code><\/pre>/)
    assert.match(html, /<th scope="row">Default<\/th><td><code>0<\/code><\/td>/)
  })

  it('inherits each table’s settings through components and fragments', async () => {
    let html = await renderToString(
      <>
        <ApiTable id="first" typeLabel="Value" defaults>
          <Fields />
        </ApiTable>
        <ApiTable id="second">
          <Fields />
          <ApiEntry id="existing-type-link" name="Options" type="interface">
            Options definition.
          </ApiEntry>
        </ApiTable>
      </>,
    )
    let [first, second] = html.split('<div id="second"')

    assert.match(first, /id="first-value"/)
    assert.match(first, /<th scope="row">Value<\/th>/)
    assert.match(first, /class="ui-api-default"/)
    assert.match(second, /id="second-value"/)
    assert.match(second, /<th scope="row">Type<\/th>/)
    assert.doesNotMatch(second, /class="ui-api-default"/)
    assert.match(second, /id="existing-type-link"/)
    assert.match(second, /href="#existing-type-link"/)
  })
})

function Fields() {
  return () => (
    <>
      <ApiEntry name="value" type="string | null">
        Current value.
      </ApiEntry>
    </>
  )
}
