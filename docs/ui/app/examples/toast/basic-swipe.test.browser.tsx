import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import type { TestContext } from 'remix/test'
import { pointer, position } from '../animation/drag/drag-test-helpers.ts'
import Example, { toastManager, ToastRegion } from './basic.example.tsx'
import { button, element, finishAnimations, mount, waitFor } from '../test-helpers.ts'

async function showToast(t: TestContext) {
  toastManager.close()
  let result = await mount(
    t,
    <>
      <Example />
      <ToastRegion />
    </>,
  )
  t.after(() => toastManager.close())
  await result.act(() => button(result.container, 'Show toast').click())
  let card = element(result.container, 'article')
  await finishAnimations(card)
  return { result, card }
}

describe('Toast swipe intent', () => {
  it('returns after a meaningful reversal even while beyond the dismissal distance', async (t) => {
    let { result, card } = await showToast(t)
    pointer(card, 'pointerdown', 100, 100)
    pointer(card, 'pointermove', 260, 100)
    pointer(card, 'pointermove', 220, 100)
    await result.act(() => pointer(card, 'pointerup', 220, 100))
    assert.equal(toastManager.toastItems.length, 1)
    await waitFor(() => assert.equal(position(card).x, 0))
    assert.equal(card.inert, false)
  })

  it('dismisses after renewed forward movement without returning to the earlier peak', async (t) => {
    let { result, card } = await showToast(t)
    pointer(card, 'pointerdown', 100, 100)
    pointer(card, 'pointermove', 260, 100)
    pointer(card, 'pointermove', 140, 100)
    pointer(card, 'pointermove', 200, 100)
    await result.act(() => pointer(card, 'pointerup', 200, 100))
    assert.equal(toastManager.toastItems.length, 0)
    assert.equal(card.inert, true)
    await waitFor(() => assert.equal(card.isConnected, false))
  })

  it('requires meaningful renewed movement and resets intent for the next gesture', async (t) => {
    let { result, card } = await showToast(t)
    pointer(card, 'pointerdown', 100, 100)
    pointer(card, 'pointermove', 260, 100)
    pointer(card, 'pointermove', 140, 100)
    pointer(card, 'pointermove', 170, 100)
    await result.act(() => pointer(card, 'pointerup', 170, 100))
    assert.equal(toastManager.toastItems.length, 1)
    await waitFor(() => assert.equal(position(card).x, 0))
    pointer(card, 'pointerdown', 100, 100)
    pointer(card, 'pointermove', 180, 100)
    await result.act(() => pointer(card, 'pointerup', 180, 100))
    assert.equal(toastManager.toastItems.length, 0)
  })

  it('tolerates small reverse jitter when releasing a forward swipe', async (t) => {
    let { result, card } = await showToast(t)
    pointer(card, 'pointerdown', 100, 100)
    pointer(card, 'pointermove', 180, 100)
    pointer(card, 'pointermove', 176, 100)
    await result.act(() => pointer(card, 'pointerup', 176, 100))
    assert.equal(toastManager.toastItems.length, 0)
  })

  it('reevaluates intent after multiple reversals within one gesture', async (t) => {
    let { result, card } = await showToast(t)
    pointer(card, 'pointerdown', 100, 100)
    pointer(card, 'pointermove', 260, 100)
    pointer(card, 'pointermove', 140, 100)
    pointer(card, 'pointermove', 200, 100)
    pointer(card, 'pointermove', 180, 100)
    pointer(card, 'pointermove', 190, 100)
    await result.act(() => pointer(card, 'pointerup', 190, 100))
    assert.equal(toastManager.toastItems.length, 1)
    await waitFor(() => assert.equal(position(card).x, 0))
    pointer(card, 'pointerdown', 100, 100)
    pointer(card, 'pointermove', 260, 100)
    pointer(card, 'pointermove', 140, 100)
    pointer(card, 'pointermove', 200, 100)
    pointer(card, 'pointermove', 180, 100)
    pointer(card, 'pointermove', 230, 100)
    await result.act(() => pointer(card, 'pointerup', 228, 100))
    assert.equal(toastManager.toastItems.length, 0)
  })

  it('includes the final release sample when deciding whether intent has changed', async (t) => {
    let { result, card } = await showToast(t)
    pointer(card, 'pointerdown', 100, 100)
    pointer(card, 'pointermove', 200, 100)
    await result.act(() => pointer(card, 'pointerup', 180, 100))
    assert.equal(toastManager.toastItems.length, 1)
    await waitFor(() => assert.equal(position(card).x, 0))
    pointer(card, 'pointerdown', 100, 100)
    pointer(card, 'pointermove', 260, 100)
    pointer(card, 'pointermove', 140, 100)
    await result.act(() => pointer(card, 'pointerup', 200, 100))
    assert.equal(toastManager.toastItems.length, 0)
  })

  it('keeps intent independent for separate toasts and ignores cancelled gestures', async (t) => {
    let { result, card } = await showToast(t)
    await result.act(() => toastManager.add({ title: 'Another toast title', timeout: false }))
    let other = element(result.container, 'article[data-toast-index="0"]')
    await finishAnimations(other)
    pointer(card, 'pointerdown', 100, 100)
    pointer(card, 'pointermove', 260, 100)
    pointer(card, 'pointermove', 140, 100)
    await result.act(() => pointer(card, 'pointercancel', 0, 0))
    assert.equal(toastManager.toastItems.length, 2)
    await waitFor(() => assert.equal(position(card).x, 0))
    pointer(other, 'pointerdown', 100, 100)
    pointer(other, 'pointermove', 180, 100)
    await result.act(() => pointer(other, 'pointerup', 180, 100))
    assert.equal(toastManager.toastItems.length, 1)
    assert.equal(toastManager.toastItems[0].title, 'Toast 1 created')
    assert.equal(card.inert, false)
  })

  it('keeps native dismissal available and makes the retained exit inert', async (t) => {
    toastManager.close()
    let result = await mount(
      t,
      <>
        <Example />
        <ToastRegion />
      </>,
    )
    t.after(() => toastManager.close())
    await result.act(() => button(result.container, 'Show toast').click())
    let card = element(result.container, 'article')
    let dismiss = button(card, 'Dismiss notification')
    dismiss.focus()
    await result.act(() => dismiss.click())
    assert.equal(toastManager.toastItems.length, 0)
    assert.equal(card.inert, true)
    assert.equal(card.getAttribute('aria-hidden'), 'true')
    assert.equal(card.contains(document.activeElement), false)
    await waitFor(() => assert.equal(card.isConnected, false))
  })
})
