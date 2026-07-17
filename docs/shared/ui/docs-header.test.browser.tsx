import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { render } from 'remix/ui/test'

import { DocsHeader } from './docs-header.tsx'

describe('DocsHeader mobile menu', () => {
  it('opens and closes without application JavaScript', async (t) => {
    let result = render(
      <DocsHeader
        brandLabel="Remix Docs"
        navigationLinks={[{ href: '/guides', label: 'Guides', current: 'location' }]}
      />,
    )
    t.after(result.cleanup)

    let menuToggle = result.container.querySelector('#site-menu-toggle')
    let primaryNavigation = result.container.querySelector('#site-primary-navigation')
    if (!(menuToggle instanceof HTMLButtonElement)) throw new Error('Missing mobile menu toggle')
    if (!(primaryNavigation instanceof HTMLElement)) {
      throw new Error('Missing mobile primary navigation')
    }

    assert.equal(primaryNavigation.matches(':popover-open'), false)

    await result.act(() => menuToggle.click())
    assert.equal(primaryNavigation.matches(':popover-open'), true)

    await result.act(() => menuToggle.click())
    assert.equal(primaryNavigation.matches(':popover-open'), false)
  })
})
