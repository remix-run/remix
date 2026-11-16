import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Nested from './nested.example.tsx'
import { button, element, key, mount, waitFor } from '../test-helpers.ts'

describe('Dialog nested example', () => {
  it('dismisses the nested dialog before its parent and restores its opener', async (t) => {
    let view = await mount(t, <Nested />)
    await view.act(() => button(view.container, 'Open dialog').click())
    let parent = element(document.body, '[role="dialog"][data-open]')
    let trigger = button(parent, 'Open nested dialog')
    await view.act(() => trigger.click())
    let child = element(document.body, '[role="dialog"][data-nested][data-open]')
    await waitFor(() => assert.equal(document.activeElement, button(child, 'Close')))
    await view.act(() => key(button(child, 'Close'), 'Escape'))
    await waitFor(() => assert.equal(child.hasAttribute('data-open'), false))
    assert.equal(parent.hasAttribute('data-open'), true)
    assert.equal(document.activeElement, trigger)
    await view.act(() => button(parent, 'Close').click())
    await waitFor(() => assert.equal(parent.hasAttribute('data-open'), false))
  })
})
