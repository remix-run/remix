import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Imperative from './imperative.example.tsx'
import { button, element, key, mount, waitFor } from '../test-helpers.ts'

describe('Dialog imperative example', () => {
  it('opens and closes through the context ref and restores focus to the opener', async (t) => {
    let view = await mount(t, <Imperative />)
    await view.act(() => button(view.container, 'Open dialog').click())
    let surface = element(document.body, '[role="dialog"][data-open]')
    await waitFor(() => assert.equal(document.activeElement, button(surface, 'Close')))
    await view.act(() => button(surface, 'Close').click())
    await waitFor(() => assert.equal(surface.hasAttribute('data-open'), false))
    assert.equal(document.activeElement, button(view.container, 'Open dialog'))
    await view.act(() => button(view.container, 'Open dialog').click())
    await waitFor(() => assert.equal(surface.hasAttribute('data-open'), true))
    await view.act(() => key(button(surface, 'Close'), 'Escape'))
    await waitFor(() => assert.equal(surface.hasAttribute('data-open'), false))
    assert.equal(document.activeElement, button(view.container, 'Open dialog'))
  })
})
