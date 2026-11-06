import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example, { ToastRegion } from './limit.example.tsx'
import { button, element, finishAnimations, mount, waitFor } from '../test-helpers.ts'

describe('Toast limit example', () => {
  it('retains overflow and reveals it when a newer toast is dismissed', async (t) => {
    let result = await mount(
      t,
      <>
        <Example />
        <ToastRegion />
      </>,
    )
    let trigger = button(result.container, 'Add toast')
    await result.act(() => trigger.click())
    let region = element(result.container, '[role="region"]')
    let oldest = element(region, '[data-toast]')
    await result.act(() => trigger.click())
    await result.act(() => trigger.click())
    await result.act(() => region.focus())
    await finishAnimations(region)

    assert.equal(region.querySelectorAll('[data-toast]').length, 3)
    assert.equal(region.querySelectorAll('[data-toast]:not([inert])').length, 2)
    assert.equal(oldest.hasAttribute('data-limited'), true)
    assert.equal(oldest.inert, true)
    assert.equal(oldest.getAttribute('aria-hidden'), 'true')
    assert.equal(getComputedStyle(oldest).opacity, '0')
    let newest = element(region, '[data-toast-index="0"]')
    assert.match(newest.textContent ?? '', /Toast 3/)

    await result.act(() => button(newest, 'Dismiss notification').click())
    await waitFor(() => assert.equal(newest.isConnected, false))
    await finishAnimations(region)
    assert.equal(region.querySelectorAll('[data-toast]').length, 2)
    assert.equal(oldest.isConnected, true)
    assert.equal(oldest.hasAttribute('data-limited'), false)
    assert.equal(oldest.inert, false)
    assert.equal(oldest.getAttribute('aria-hidden'), null)
    assert.equal(getComputedStyle(oldest).opacity, '1')
    assert.match(oldest.textContent ?? '', /Toast 1/)
    let front = element(region, '[data-toast-index="0"]')
    assert.ok(oldest.getBoundingClientRect().bottom < front.getBoundingClientRect().top)
  })
})
