import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import InitialFocus from './initial-focus.example.tsx'
import { button, element, mount, waitFor } from '../test-helpers.ts'

describe('Dialog initial focus example', () => {
  it('focuses Cancel instead of the first button and restores focus after closing', async (t) => {
    let view = await mount(t, <InitialFocus />)
    let trigger = button(view.container, 'Open dialog')
    await view.act(() => trigger.click())
    let surface = element(document.body, '[role="dialog"][data-open]')
    let cancel = button(surface, 'Cancel')
    assert.equal(surface.querySelector('button'), button(surface, 'Confirm'))
    await waitFor(() => assert.equal(document.activeElement, cancel))
    await view.act(() => cancel.click())
    await waitFor(() => assert.equal(surface.hasAttribute('data-open'), false))
    assert.equal(document.activeElement, trigger)
  })
})
