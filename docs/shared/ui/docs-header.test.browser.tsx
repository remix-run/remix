import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { render } from 'remix/ui/test'

import { DocsHeader } from './docs-header.tsx'

describe('DocsHeader mobile menu', () => {
  it('keeps search in the top header on mobile', (t) => {
    assert.equal(window.matchMedia('(width < 900px)').matches, true)
    let result = render(<DocsHeader brandLabel="Remix Docs" navigationLinks={[]} compactSearch />)
    t.after(result.cleanup)

    let searchButton = result.container.querySelector('#docs-search-button')
    let compactSearchButton = result.container.querySelector('#docs-search-compact')
    if (!(searchButton instanceof HTMLButtonElement)) throw new Error('Missing search button')
    if (!(compactSearchButton instanceof HTMLButtonElement)) {
      throw new Error('Missing compact search button')
    }

    let style = getComputedStyle(searchButton)
    assert.equal(style.position, 'absolute')
    assert.equal(style.top, '16px')
    assert.equal(style.transform, 'none')
    assert.equal(style.transitionDuration, '0s')
    let compactStyle = getComputedStyle(compactSearchButton)
    assert.equal(compactStyle.display, 'none')
    assert.equal(compactStyle.transitionDuration, '0s')
  })

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
