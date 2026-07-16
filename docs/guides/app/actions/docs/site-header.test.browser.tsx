import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { createRoot } from 'remix/ui'

import { SiteHeader } from './site-header.tsx'

describe('SiteHeader mobile menu', () => {
  it('opens and closes without application JavaScript', (t) => {
    let container = document.createElement('div')
    let root = createRoot(container)
    document.body.append(container)
    t.after(() => {
      root.dispose()
      container.remove()
    })

    root.render(<SiteHeader />)
    root.flush()

    let menuToggle = container.querySelector('#site-menu-toggle')
    let primaryNavigation = container.querySelector('#site-primary-navigation')
    if (!(menuToggle instanceof HTMLButtonElement)) throw new Error('Missing mobile menu toggle')
    if (!(primaryNavigation instanceof HTMLElement)) {
      throw new Error('Missing mobile primary navigation')
    }

    assert.equal(primaryNavigation.matches(':popover-open'), false)

    menuToggle.click()
    assert.equal(primaryNavigation.matches(':popover-open'), true)

    menuToggle.click()
    assert.equal(primaryNavigation.matches(':popover-open'), false)
  })
})
