import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './basic.example.tsx'
import { button, element, mount, waitFor } from '../test-helpers.ts'

describe('Portal example', () => {
  it('renders fixed content outside its clipping ancestor and removes it when hidden', async (t) => {
    let view = await mount(t, <Example />)
    let trigger = button(view.container, 'Show content')
    await view.act(() => trigger.click())
    await waitFor(() => assert.ok(document.querySelector('[role="status"]')))
    let content = element(document.body, '[role="status"]')
    assert.equal(content.textContent, 'Portaled content')
    assert.equal(view.container.contains(content), false)
    assert.equal(getComputedStyle(content).position, 'fixed')
    assert.equal(trigger.getAttribute('aria-expanded'), 'true')
    await view.act(() => trigger.click())
    await waitFor(() => assert.equal(content.isConnected, false))
    assert.equal(trigger.getAttribute('aria-expanded'), 'false')
    await view.act(() => trigger.click())
    await waitFor(() => assert.ok(document.querySelector('[role="status"]')))
    await view.act(() => trigger.click())
    await waitFor(() => assert.equal(document.querySelector('[role="status"]'), null))
  })
})
