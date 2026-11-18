import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import NonModal from './non-modal.example.tsx'
import { button, element, key, mount, waitFor } from '../test-helpers.ts'

describe('Dialog non-modal example', () => {
  it('keeps a non-modal dialog open when focus returns to the page', async (t) => {
    let view = await mount(t, <NonModal />)
    let trigger = button(view.container, 'Open dialog')
    await view.act(() => trigger.click())
    let surface = element(document.body, '[role="dialog"][data-open]')
    await waitFor(() => assert.equal(document.activeElement, button(surface, 'Close')))
    await view.act(() => trigger.focus())
    assert.equal(document.activeElement, trigger)
    assert.equal(surface.hasAttribute('data-open'), true)
    await view.act(() => key(trigger, 'Escape'))
    await waitFor(() => assert.equal(surface.hasAttribute('data-open'), false))
  })
})
