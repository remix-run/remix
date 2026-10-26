import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example, { ToastRegion } from './actions.example.tsx'
import { button, element, mount, waitFor } from '../test-helpers.ts'

describe('Toast action array example', () => {
  it('provides a native documentation link and a working dismiss action', async (t) => {
    let result = await mount(
      t,
      <>
        <Example />
        <ToastRegion />
      </>,
    )
    await result.act(() => button(result.container, 'Show toast with link').click())
    let notification = element(result.container, '[data-toast]')
    let link = element(notification, 'a')
    assert.equal(link.textContent?.trim(), 'Read more')
    assert.equal(link.getAttribute('href'), '/animation/entrance-exit/')
    assert.equal(notification.hasAttribute('inert'), false)
    await result.act(() => button(notification, 'Dismiss').click())
    await waitFor(() => assert.equal(result.container.querySelector('[data-toast]'), null))
  })
})
