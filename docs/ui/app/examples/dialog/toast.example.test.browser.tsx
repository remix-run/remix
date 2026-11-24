import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import DialogToast from './toast.example.tsx'
import { button, element, finishAnimations, key, mount, waitFor } from '../test-helpers.ts'

function pulseAnimation(surface: HTMLElement) {
  return surface.getAnimations().find((animation) => {
    let effect = animation.effect
    return (
      effect instanceof KeyframeEffect &&
      effect.getKeyframes().some((keyframe) => Number(keyframe.scale) > 1)
    )
  })
}

describe('Dialog stacking example', () => {
  it('stacks the portaled Select above the dialog and restores focus after selecting', async (t) => {
    let view = await mount(t, <DialogToast />)
    let opener = button(view.container, 'Open dialog')
    await view.act(() => opener.click())
    let dialog = element(document.body, '[role="dialog"][data-open]')
    let trigger = button(dialog, 'Option A')
    await view.act(() => trigger.click())
    let popup = element(document.body, '[data-popover][data-open]')
    let list = element(popup, '[role="listbox"]')
    assert.equal(dialog.contains(popup), false)
    assert.equal(popup.closest('[inert]'), null)
    assert.equal(document.activeElement, list)
    assert.ok(Number(getComputedStyle(popup).zIndex) > Number(getComputedStyle(dialog).zIndex))
    await finishAnimations(popup)
    let option = element(list, '[role="option"]:nth-child(2)')
    let rect = option.getBoundingClientRect()
    assert.ok(
      option.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)),
    )
    await view.act(() => option.click())
    await waitFor(() => assert.equal(popup.hasAttribute('data-open'), false))
    await waitFor(() => assert.equal(trigger.textContent?.trim(), 'Option B'))
    assert.equal(document.activeElement, trigger)
    assert.equal(dialog.hasAttribute('data-open'), true)
    await view.act(() => key(trigger, 'Escape'))
    await waitFor(() => assert.equal(dialog.hasAttribute('data-open'), false))
    assert.equal(document.activeElement, opener)
  })

  it('keeps notification actions interactive and dismisses the Select before the dialog', async (t) => {
    let view = await mount(t, <DialogToast />)
    await view.act(() => button(view.container, 'Open dialog').click())
    let dialog = element(document.body, '[role="dialog"][data-open]')
    await view.act(() => button(dialog, 'Toast').click())
    let viewport = element(document.body, '[aria-label="Notifications"]')
    await waitFor(() => assert.match(viewport.textContent ?? '', /Action completed/))
    let trigger = button(dialog, 'Option A')
    await view.act(() => trigger.click())
    let popup = element(document.body, '[data-popover][data-open]')
    assert.equal(viewport.closest('[inert]'), null)
    await view.act(() => button(viewport, 'Dismiss notification').click())
    await waitFor(() => assert.doesNotMatch(viewport.textContent ?? '', /Action completed/))
    await waitFor(() => assert.equal(popup.hasAttribute('data-open'), false))
    assert.equal(dialog.hasAttribute('data-open'), true)
  })

  it('keeps the global notification visible after the dialog closes', async (t) => {
    let view = await mount(t, <DialogToast />)
    await view.act(() => button(view.container, 'Open dialog').click())
    let surface = element(document.body, '[role="dialog"][data-open]')
    await view.act(() => button(surface, 'Toast').click())
    let viewport = element(document.body, '[aria-label="Notifications"]')
    await waitFor(() => assert.match(viewport.textContent ?? '', /Action completed/))
    assert.equal(viewport.closest('[inert]'), null)
    await view.act(() => button(surface, 'Close').click())
    await waitFor(() => assert.equal(surface.hasAttribute('data-open'), false))
    assert.equal(viewport.checkVisibility(), true)
    assert.match(viewport.textContent ?? '', /Action completed/)
    await view.act(() => button(viewport, '×').click())
    await waitFor(() => assert.doesNotMatch(viewport.textContent ?? '', /Action completed/))
  })

  it('replays a pulse when the dialog action updates the same notification', async (t) => {
    let view = await mount(t, <DialogToast />)
    await view.act(() => button(view.container, 'Open dialog').click())
    let dialog = element(document.body, '[role="dialog"][data-open]')
    let publish = button(dialog, 'Toast')
    await view.act(() => publish.click())
    let viewport = element(document.body, '[aria-label="Notifications"]')
    let notification = element(viewport, '[data-toast]')
    await finishAnimations(viewport)
    assert.equal(pulseAnimation(notification), undefined)
    let dismiss = button(notification, 'Dismiss notification')
    await view.act(() => dismiss.focus())
    assert.equal(pulseAnimation(notification), undefined)

    await view.act(() => publish.click())
    assert.equal(viewport.querySelectorAll('[data-toast]').length, 1)
    assert.equal(element(viewport, '[data-toast]'), notification)
    assert.equal(document.activeElement, dismiss)
    let firstPulse = pulseAnimation(notification)
    assert.ok(firstPulse, 'Updating the same notification starts a pulse')
    firstPulse.pause()
    await view.act(() => viewport.focus())
    assert.equal(pulseAnimation(notification), firstPulse)
    await view.act(() => publish.click())
    let secondPulse = pulseAnimation(notification)
    assert.ok(secondPulse, 'Another update restarts the pulse')
    assert.notEqual(secondPulse, firstPulse)
    assert.equal(firstPulse.playState, 'idle')
    await view.act(() => dismiss.click())
    await waitFor(() => assert.equal(notification.isConnected, false))
  })

  it('updates the same notification without pulsing when reduced motion is requested', async (t) => {
    t.mock.method(window, 'matchMedia', () => ({ matches: true }))
    let view = await mount(t, <DialogToast />)
    await view.act(() => button(view.container, 'Open dialog').click())
    let dialog = element(document.body, '[role="dialog"][data-open]')
    let publish = button(dialog, 'Toast')
    await view.act(() => publish.click())
    let viewport = element(document.body, '[aria-label="Notifications"]')
    let notification = element(viewport, '[data-toast]')
    await view.act(() => publish.click())
    assert.equal(element(viewport, '[data-toast]'), notification)
    assert.equal(pulseAnimation(notification), undefined)
    await view.act(() => button(notification, 'Dismiss notification').click())
    await waitFor(() => assert.equal(notification.isConnected, false))
  })
})
