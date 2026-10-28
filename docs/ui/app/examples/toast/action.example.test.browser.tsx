import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example, { ToastRegion } from './action.example.tsx'
import { button, element, finishAnimations, frame, mount, waitFor } from '../test-helpers.ts'

describe('Toast action example', () => {
  it('publishes a follow-up confirmation after Undo and restores focus', async (t) => {
    let result = await mount(
      t,
      <>
        <Example />
        <ToastRegion />
      </>,
    )
    let trigger = button(result.container, 'Show toast with action')
    trigger.focus()
    await result.act(() => trigger.click())
    let toastItem = element(result.container, '[data-toast]')
    assert.match(toastItem.textContent ?? '', /Action performed/)
    assert.equal(toastItem.getAttribute('aria-describedby'), null)
    assert.equal(/Control|Ctrl|Command|⌘/.test(toastItem.textContent ?? ''), false)
    assert.equal(document.activeElement, trigger)
    let action = button(toastItem, 'Undo')
    assert.equal(action.getAttribute('aria-hidden'), null)
    let announcement = element(result.container, '[aria-live="polite"]')
    assert.equal(
      announcement.textContent,
      'Action performed. Press Control Z or Command Z to undo while this notification is open.',
    )
    assert.equal(announcement.querySelector('button'), null)
    action.focus()
    await result.act(() => action.click())
    assert.equal(document.activeElement, trigger)
    await waitFor(() => assert.equal(toastItem.isConnected, false))
    let confirmation = element(result.container, '[data-toast]')
    assert.match(confirmation.textContent ?? '', /Action undone/)
    assert.equal(confirmation.textContent?.includes('Undo'), false)
    await result.act(() => button(confirmation, 'Dismiss notification').click())
    await waitFor(() => assert.equal(result.container.querySelector('[data-toast]'), null))
  })

  it('supports Control+Z and Command+Z while leaving editing and unavailable actions alone', async (t) => {
    let result = await mount(
      t,
      <>
        <Example />
        <ToastRegion />
        <input aria-label="Notes" />
        <div contentEditable aria-label="Editable notes" />
      </>,
    )
    let trigger = button(result.container, 'Show toast with action')
    await result.act(() => trigger.click())
    let input = element(result.container, 'input')
    let editing = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
    await result.act(() => {
      input.focus()
      input.dispatchEvent(editing)
    })
    assert.equal(editing.defaultPrevented, false)
    assert.ok(button(result.container, 'Undo'))
    let editable = element(result.container, '[contenteditable]')
    let richEditing = new KeyboardEvent('keydown', {
      key: 'z',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    })
    await result.act(() => {
      editable.focus()
      editable.dispatchEvent(richEditing)
    })
    assert.equal(richEditing.defaultPrevented, false)
    let redo = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    })
    await result.act(() => trigger.dispatchEvent(redo))
    assert.equal(redo.defaultPrevented, false)
    let controlUndo = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
    await result.act(() => {
      trigger.focus()
      trigger.dispatchEvent(controlUndo)
    })
    assert.equal(controlUndo.defaultPrevented, true)
    await waitFor(() =>
      assert.equal(result.container.querySelector('[data-toast] button[aria-keyshortcuts]'), null),
    )
    assert.match(
      element(result.container, '[data-toast]:not([inert])').textContent ?? '',
      /Action undone/,
    )
    let noAction = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
    await result.act(() => trigger.dispatchEvent(noAction))
    assert.equal(noAction.defaultPrevented, false)
    await result.act(() => button(result.container, 'Dismiss notification').click())
    await waitFor(() => assert.equal(result.container.querySelector('[data-toast]'), null))
    await result.act(() => trigger.click())
    let commandUndo = new KeyboardEvent('keydown', {
      key: 'z',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    })
    await result.act(() => trigger.dispatchEvent(commandUndo))
    assert.equal(commandUndo.defaultPrevented, true)
    await waitFor(() =>
      assert.equal(result.container.querySelector('[data-toast] button[aria-keyshortcuts]'), null),
    )
    assert.match(
      element(result.container, '[data-toast]:not([inert])').textContent ?? '',
      /Action undone/,
    )
    await result.act(() => button(result.container, 'Dismiss notification').click())
    await waitFor(() => assert.equal(result.container.querySelector('[data-toast]'), null))
  })

  it('keeps the confirmation entrance anchored while the hovered toast exits', async (t) => {
    let result = await mount(
      t,
      <>
        <Example />
        <ToastRegion />
      </>,
    )
    await result.act(() => button(result.container, 'Show toast with action').click())
    let region = element(result.container, '[role="region"]')
    await finishAnimations(region)
    await result.act(() =>
      region.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' })),
    )
    await result.act(() => button(region, 'Undo').click())
    let confirmation = element(region, '[data-toast]:not([inert])')
    let previousTop = confirmation.getBoundingClientRect().top
    let deadline = performance.now() + 3000
    while (region.querySelector('[inert]')) {
      assert.ok(performance.now() < deadline, 'The outgoing toast finishes its exit')
      let gap = parseFloat(getComputedStyle(confirmation).marginBlockStart)
      assert.equal(region.offsetHeight, confirmation.offsetHeight + gap)
      let top = confirmation.getBoundingClientRect().top
      assert.ok(top <= previousTop + 1, 'The entrance moves upwards without reversing direction')
      previousTop = top
      await frame()
    }
    await result.act(() => button(confirmation, 'Dismiss notification').click())
    await waitFor(() => assert.equal(region.querySelector('[data-toast]'), null))
  })
})
