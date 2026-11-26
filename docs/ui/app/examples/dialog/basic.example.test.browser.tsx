import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './basic.example.tsx'
import { button, element, key, mount, waitFor } from '../test-helpers.ts'

describe('Dialog example', () => {
  it('opens a portaled dialog and restores focus after closing or pressing Escape', async (t) => {
    let result = await mount(t, <Example />)
    let trigger = button(result.container, 'Open dialog')
    await result.act(() => trigger.click())
    let surface = element(document.body, '[role="dialog"]')
    let close = button(surface, 'Close')
    await waitFor(() => assert.equal(document.activeElement, close))
    let dark = window.matchMedia('(prefers-color-scheme: dark)').matches
    assert.equal(
      getComputedStyle(trigger).backgroundColor,
      dark ? 'rgb(37, 37, 43)' : 'rgb(255, 255, 255)',
    )
    assert.equal(
      getComputedStyle(surface).backgroundColor,
      dark ? 'rgb(27, 27, 32)' : 'rgb(255, 255, 255)',
    )
    assert.equal(result.container.contains(surface), false)
    assert.equal(surface.hasAttribute('popover'), false)
    await result.act(() => close.click())
    await waitFor(() => assert.equal(surface.hasAttribute('data-open'), false))
    assert.equal(document.activeElement, trigger)
    await result.act(() => trigger.click())
    await waitFor(() => assert.equal(document.activeElement, close))
    await result.act(() => key(close, 'Escape'))
    await waitFor(() => assert.equal(surface.hasAttribute('data-open'), false))
    assert.equal(document.activeElement, trigger)
  })
})
