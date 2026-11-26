import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import PreventingDismissal from './preventing-dismissal.example.tsx'
import { button, element, key, mount, waitFor } from '../test-helpers.ts'

describe('Dialog preventing-dismissal example', () => {
  it('prevents Escape dismissal and allows the close button', async (t) => {
    let view = await mount(t, <PreventingDismissal />)
    let trigger = button(view.container, 'Open dialog')
    await view.act(() => trigger.click())
    let surface = element(document.body, '[role="dialog"][data-open]')
    await waitFor(() => assert.equal(document.activeElement, button(surface, 'Close')))
    await view.act(() => key(button(surface, 'Close'), 'Escape'))
    assert.equal(surface.hasAttribute('data-open'), true)
    await view.act(() => button(surface, 'Close').click())
    await waitFor(() => assert.equal(surface.hasAttribute('data-open'), false))
    assert.equal(document.activeElement, trigger)
  })
})
