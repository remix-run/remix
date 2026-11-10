import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example, { toastManager, ToastRegion } from './basic.example.tsx'
import { button, element, frame, mount, waitFor } from '../test-helpers.ts'

async function settle(target: Element) {
  await frame()
  await waitFor(() =>
    assert.equal(
      target
        .getAnimations({ subtree: true })
        .filter((animation) => animation.playState === 'running').length,
      0,
    ),
  )
}

describe('Toast stack', () => {
  it('starts dismissal from the visible stack positions and slides the toast out', async (t) => {
    toastManager.closeAll()
    let result = await mount(t, <ToastRegion />)
    t.after(() => toastManager.closeAll())
    await result.act(() => {
      toastManager.add({ title: 'First toast' })
      toastManager.add({ title: 'Second toast' })
      toastManager.add({ title: 'Third toast' })
    })
    let region = element(result.container, '[role="region"]')
    await settle(region)
    await result.act(() =>
      region.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' })),
    )
    await settle(region)
    let outgoing = element(region, '[data-toast-index="0"]')
    let survivor = element(region, '[data-toast-index="1"]')
    let previousTop = survivor.getBoundingClientRect().top
    let previousLeft = outgoing.getBoundingClientRect().left
    await result.act(() => button(outgoing, 'Dismiss notification').click())
    for (let animation of region.getAnimations({ subtree: true })) {
      animation.pause()
      animation.currentTime = 0
    }
    assert.ok(
      Math.abs(survivor.getBoundingClientRect().top - previousTop) < 1,
      'A surviving toast starts at its previous visible position rather than jumping',
    )
    let exit = outgoing
      .getAnimations()
      .find(
        (animation) =>
          animation.effect instanceof KeyframeEffect &&
          animation.effect.getKeyframes().some((keyframe) => keyframe.translate !== undefined),
      )
    assert.ok(exit, 'Dismissal retains the slide animation')
    exit.currentTime = 70
    assert.ok(outgoing.getBoundingClientRect().left > previousLeft + 50)
    await result.act(() => toastManager.closeAll())
    for (let animation of region.getAnimations({ subtree: true })) animation.finish()
  })

  it('closes a gap in the expanded stack without reversing the remaining cards', async (t) => {
    toastManager.closeAll()
    let result = await mount(t, <ToastRegion />)
    t.after(() => toastManager.closeAll())
    await result.act(() => {
      toastManager.add({ title: 'First toast' })
      toastManager.add({ title: 'Second toast' })
      toastManager.add({ title: 'Third toast' })
    })
    let region = element(result.container, '[role="region"]')
    await settle(region)
    await result.act(() =>
      region.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' })),
    )
    await settle(region)
    let outgoing = element(region, '[data-toast-index="1"]')
    let survivor = element(region, '[data-toast-index="2"]')
    let startingTop = survivor.getBoundingClientRect().top
    let previousTop = startingTop
    await result.act(() => button(outgoing, 'Dismiss notification').click())
    let deadline = performance.now() + 3000
    while (
      outgoing.isConnected ||
      region.getAnimations({ subtree: true }).some((animation) => animation.playState === 'running')
    ) {
      assert.ok(performance.now() < deadline, 'The stack settles after dismissal')
      let top = survivor.getBoundingClientRect().top
      assert.ok(top >= previousTop - 1, 'The remaining card moves toward the gap without bouncing')
      previousTop = top
      await frame()
    }
    assert.ok(survivor.getBoundingClientRect().top > startingTop + 40)
    await result.act(() => toastManager.closeAll())
    await waitFor(() => assert.equal(region.querySelector('[data-toast]'), null))
  })

  it('keeps an exiting covered card behind the front at the collapsed stack height', async (t) => {
    toastManager.closeAll()
    let result = await mount(
      t,
      <>
        <Example />
        <ToastRegion />
      </>,
    )
    t.after(() => toastManager.closeAll())
    let rearId = toastManager.add({ title: 'Toast title' })
    await result.act(() =>
      toastManager.add({
        title: 'Another toast title',
        description:
          'This is a longer toast description. It spans several lines to show how toasts with different amounts of content stack, expand and collapse together.',
      }),
    )
    let region = element(result.container, '[role="region"]')
    await settle(region)
    let front = element(region, '[data-toast-index="0"]')
    let rear = element(region, '[data-toast-index="1"]')
    let rearHeight = rear.offsetHeight
    await result.act(() => toastManager.close(rearId))
    for (let animation of rear.getAnimations()) animation.pause()
    await frame()
    assert.equal(rear.isConnected, true)
    assert.ok(
      Number(getComputedStyle(rear).zIndex) < Number(getComputedStyle(front).zIndex),
      'An exiting rear card must not jump above the front card',
    )
    assert.equal(rear.offsetHeight, rearHeight)
    assert.equal(getComputedStyle(button(rear, 'Dismiss notification')).visibility, 'hidden')
    assert.equal(getComputedStyle(element(rear, ':scope > div > div')).overflow, 'hidden')
  })

  it('keeps the collapsed stack sized by the logical front during entry and retained exit', async (t) => {
    toastManager.closeAll()
    let result = await mount(
      t,
      <>
        <Example />
        <ToastRegion />
      </>,
    )
    t.after(() => toastManager.closeAll())
    let region = element(result.container, '[role="region"]')
    await result.act(() => button(result.container, 'Show toast').click())
    await result.act(() => button(result.container, 'Show toast').click())
    await settle(region)
    await result.act(() =>
      toastManager.add({
        title: 'Another toast title',
        description:
          'This is a longer toast description. It spans several lines to show how toasts with different amounts of content stack, expand and collapse together.',
      }),
    )
    await frame()
    let entering = element(region, 'article:first-of-type')
    let rear = element(region, 'article:nth-of-type(2)')
    assert.equal(region.offsetHeight, entering.offsetHeight)
    assert.ok(region.offsetHeight > 100, 'Entry does not grow the whole stack from zero')
    assert.equal(rear.offsetHeight, entering.offsetHeight)
    await settle(region)
    await result.act(() => button(entering, 'Dismiss notification').click())
    await frame()
    let front = element(region, '[data-toast-index="0"]:not([inert])')
    assert.equal(region.offsetHeight, front.offsetHeight)
    assert.ok(region.offsetHeight > 60, 'The retained exit does not collapse the whole stack')
    assert.ok(region.offsetHeight < 100, 'The new short front determines stack height')
    await result.act(() => button(result.container, 'Show toast').click())
    await waitFor(() => assert.equal(entering.isConnected, false))
    await settle(region)
    assert.equal(region.offsetHeight, element(region, '[data-toast-index="0"]').offsetHeight)
  })

  it('fans out natural mixed-height cards and promotes overflow without measuring them', async (t) => {
    toastManager.closeAll()
    let result = await mount(
      t,
      <>
        <Example />
        <ToastRegion />
      </>,
    )
    t.after(() => toastManager.closeAll())
    await result.act(() => button(result.container, 'Show toast').click())
    await result.act(() =>
      toastManager.add({
        title: 'Another toast title',
        description:
          'This is a longer toast description. It spans several lines to show how toasts with different amounts of content stack, expand and collapse together.',
      }),
    )
    await result.act(() => button(result.container, 'Show toast').click())
    await result.act(() =>
      toastManager.add({
        title: 'Another toast title',
        description:
          'This is a longer toast description. It spans several lines to show how toasts with different amounts of content stack, expand and collapse together.',
      }),
    )
    let region = element(result.container, '[role="region"]')
    await settle(region)
    let front = element(region, 'article:first-of-type')
    let middle = element(region, 'article:nth-of-type(2)')
    let back = element(region, 'article:nth-of-type(3)')
    let limited = element(region, '[data-limited]')
    assert.equal(limited.inert, true)
    assert.equal(front.offsetHeight, middle.offsetHeight)
    assert.equal(
      element(front, ':scope > div > div').offsetHeight,
      element(middle, ':scope > div > div').offsetHeight,
    )
    assert.equal(getComputedStyle(element(middle, ':scope > div > div > div')).opacity, '0')
    let rearDismiss = button(middle, 'Dismiss notification')
    assert.equal(getComputedStyle(rearDismiss).visibility, 'hidden')
    rearDismiss.focus()
    assert.notEqual(document.activeElement, rearDismiss)
    let collapsed = middle.getBoundingClientRect()
    let frontBottom = front.getBoundingClientRect().bottom
    assert.ok(
      frontBottom - collapsed.bottom >= 12,
      `Collapsed peek: ${frontBottom - collapsed.bottom}`,
    )
    assert.ok(
      frontBottom - collapsed.bottom <= 16,
      `Collapsed peek: ${frontBottom - collapsed.bottom}`,
    )
    await result.act(() =>
      region.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' })),
    )
    await waitFor(() =>
      assert.ok(
        middle
          .getAnimations()
          .some(
            (animation) =>
              animation.effect instanceof KeyframeEffect &&
              animation.effect
                .getKeyframes()
                .some(
                  (keyframe) => keyframe.transform !== undefined && keyframe.transform !== 'none',
                ),
          ),
        'The layout primitive projects the fan-out',
      ),
    )
    await settle(region)
    let expanded = middle.getBoundingClientRect()
    assert.ok(expanded.bottom + 11 <= front.getBoundingClientRect().top)
    assert.ok(back.getBoundingClientRect().bottom + 11 <= expanded.top)
    assert.equal(front.offsetHeight, back.offsetHeight)
    assert.ok(front.offsetHeight > middle.offsetHeight + 20)
    assert.equal(getComputedStyle(element(middle, ':scope > div > div > div')).opacity, '1')
    assert.equal(getComputedStyle(rearDismiss).visibility, 'visible')
    assert.equal(limited.offsetHeight, 0)

    await result.act(() => button(middle, 'Dismiss notification').click())
    await frame()
    await result.act(() =>
      region.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' })),
    )
    await frame()
    await result.act(() =>
      region.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' })),
    )
    await waitFor(() => assert.equal(middle.isConnected, false))
    await settle(region)
    assert.equal(limited.inert, false)
    assert.equal(getComputedStyle(limited).opacity, '1')
    assert.ok(limited.getBoundingClientRect().bottom + 11 <= back.getBoundingClientRect().top)
    assert.ok(back.getBoundingClientRect().bottom + 11 <= front.getBoundingClientRect().top)

    await result.act(() =>
      region.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' })),
    )
    await settle(region)
    assert.ok(
      Math.abs(front.getBoundingClientRect().bottom - back.getBoundingClientRect().bottom - 14) < 1,
    )
    assert.equal(front.offsetHeight, limited.offsetHeight)
  })
})
