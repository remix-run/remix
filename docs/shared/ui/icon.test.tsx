import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { renderToString } from 'remix/ui/server'

import { Icon } from './icon.tsx'

describe('Icon', () => {
  it('renders a decorative reference to the shared SVG sprite', async () => {
    let html = await renderToString(<Icon name="search" />)

    assert.match(html, /<svg aria-hidden="true" focusable="false">/)
    assert.match(html, /<use href="\/icons\.svg#search">/)
  })
})
