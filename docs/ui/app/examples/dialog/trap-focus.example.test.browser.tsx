import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import TrapFocus from './trap-focus.example.tsx'
import { button, element, mount, waitFor } from '../test-helpers.ts'

describe('Dialog trap-focus example', () => {
  it('traps focus without making the page inert', async (t) => {
    let view = await mount(t, <TrapFocus />)
    let trigger = button(view.container, 'Open dialog')
    await view.act(() => trigger.click())
    let surface = element(document.body, '[role="dialog"][data-open]')
    await waitFor(() => assert.equal(document.activeElement, button(surface, 'Close')))
    assert.equal(trigger.closest('[inert]'), null)
    await view.act(() => trigger.focus())
    assert.equal(surface.contains(document.activeElement), true)
    await view.act(() => button(surface, 'Close').click())
    await waitFor(() => assert.equal(surface.hasAttribute('data-open'), false))
    assert.equal(document.activeElement, trigger)
  })
})
