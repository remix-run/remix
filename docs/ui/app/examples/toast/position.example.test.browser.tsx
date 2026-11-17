import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example, { ToastRegion } from './position.example.tsx'
import { button, element, finishAnimations, mount, waitFor } from '../test-helpers.ts'

describe('Toast custom position example', () => {
  it('centers the stack at the top and expands older items downwards', async (t) => {
    let result = await mount(
      t,
      <>
        <Example />
        <ToastRegion />
      </>,
    )
    let trigger = button(result.container, 'Show top-center toast')
    trigger.focus()
    await result.act(() => trigger.click())
    let region = element(result.container, '[role="region"]')
    let older = element(region, '[data-toast]')
    await finishAnimations(region)
    let bounds = older.getBoundingClientRect()
    assert.ok(Math.abs(bounds.top - 16) < 1)
    assert.ok(Math.abs(bounds.left + bounds.width / 2 - innerWidth / 2) < 1)
    assert.equal(document.activeElement, trigger)

    await result.act(() => trigger.click())
    let newer = element(region, '[data-toast]')
    await result.act(() => region.focus())
    await finishAnimations(region)
    assert.ok(older.getBoundingClientRect().top > newer.getBoundingClientRect().bottom)

    await result.act(() => button(newer, 'Dismiss notification').click())
    await waitFor(() => assert.equal(newer.isConnected, false))
    assert.equal(older.isConnected, true)
  })
})
