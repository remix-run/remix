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
  it('deduplicates three publishers and retains a dismissed toast until its exit finishes', async (t) => {
    let result = await mount(
      t,
      <>
        <Example />
        <ToastRegion />
      </>,
    )
    await result.act(() => button(result.container, 'Show saved toast').click())
    await result.act(() => button(result.container, 'Show copied toast').click())
    await result.act(() => button(result.container, 'Show export toast').click())
    await settle(result.container)
    let saved = element(result.container, '[data-toast][data-notification="saved"]')
    let copied = element(result.container, '[data-toast][data-notification="copied"]')
    await result.act(() => button(result.container, 'Show copied toast').click())
    assert.equal(result.container.querySelectorAll('[data-toast]').length, 3)
    assert.equal(element(result.container, '[data-toast][data-notification="copied"]'), copied)
    assert.match(copied.textContent ?? '', /Published 2 times/)
    await result.act(() => element(result.container, '[role="region"]').focus())
    await settle(result.container)
    let top = saved.getBoundingClientRect().top
    await result.act(() => button(copied, 'Dismiss notification').click())
    assert.equal(copied.inert, true)
    assert.equal(copied.isConnected, true)
    assert.ok(Math.abs(saved.getBoundingClientRect().top - top) < 1)
    await waitFor(() => assert.equal(copied.isConnected, false))
    assert.equal(result.container.querySelectorAll('[data-toast]').length, 2)
    assert.equal(element(result.container, '[data-toast][data-notification="saved"]'), saved)
    await settle(result.container)
    assert.ok(saved.getBoundingClientRect().top > top + 50)
  })
})
