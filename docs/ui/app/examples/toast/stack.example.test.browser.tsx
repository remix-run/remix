import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example, { ToastRegion } from './stack.example.tsx'
import { button, element, frame, mount, waitFor } from '../test-helpers.ts'

async function settle(target: Element) {
  await frame()
  await waitFor(() =>
    assert.equal(
      target
        .getAnimations({ subtree: true })
        .some((animation) => animation.playState === 'running'),
      false,
    ),
  )
}

describe('Toast stack example', () => {
  it('deduplicates three toast IDs and retains a dismissed toast until its exit finishes', async (t) => {
    let result = await mount(
      t,
      <>
        <Example />
        <ToastRegion />
      </>,
    )
    await result.act(() => button(result.container, 'Toast ID 1').click())
    await result.act(() => button(result.container, 'Toast ID 2').click())
    await result.act(() => button(result.container, 'Toast ID 3').click())
    await settle(result.container)
    let first = element(result.container, '[data-toast][data-toast-id="1"]')
    let second = element(result.container, '[data-toast][data-toast-id="2"]')
    await result.act(() => button(result.container, 'Toast ID 2').click())
    assert.equal(result.container.querySelectorAll('[data-toast]').length, 3)
    assert.equal(element(result.container, '[data-toast][data-toast-id="2"]'), second)
    assert.match(second.textContent ?? '', /Published 2 times/)
    await result.act(() => element(result.container, '[role="region"]').focus())
    await settle(result.container)
    let top = first.getBoundingClientRect().top
    await result.act(() => button(second, 'Dismiss notification').click())
    assert.equal(second.inert, true)
    assert.equal(second.isConnected, true)
    assert.ok(Math.abs(first.getBoundingClientRect().top - top) < 1)
    await waitFor(() => assert.equal(second.isConnected, false))
    assert.equal(result.container.querySelectorAll('[data-toast]').length, 2)
    assert.equal(element(result.container, '[data-toast][data-toast-id="1"]'), first)
    await settle(result.container)
    assert.ok(first.getBoundingClientRect().top > top + 50)
  })
})
