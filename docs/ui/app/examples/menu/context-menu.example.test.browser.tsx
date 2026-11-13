import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './context-menu.example.tsx'
import { element, key, mount, waitFor } from '../test-helpers.ts'

describe('Context menu example', () => {
  it('opens at the pointer and activates a file action', async (t) => {
    let result = await mount(t, <Example />)
    let target = element(result.container, '[tabindex="0"]')
    let surface = element(result.container, '[popover]')
    let list = element(result.container, '[role="menu"]')
    let selected: string | undefined
    result.container.addEventListener('rmx:menu-select', (event) => {
      selected = event.item.name
    })

    let event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 180,
      clientY: 120,
    })
    await result.act(() => target.dispatchEvent(event))
    assert.equal(event.defaultPrevented, true)
    await waitFor(() => assert.equal(surface.matches(':popover-open'), true))
    await waitFor(() => assert.equal(document.activeElement, list))
    assert.equal(surface.style.left, '180px')
    assert.equal(surface.style.top, '120px')

    await result.act(() => key(list, 'ArrowDown'))
    await result.act(() => key(list, 'Enter'))
    await waitFor(() => assert.equal(selected, 'rename'))
    await waitFor(() => assert.equal(surface.matches(':popover-open'), false))
    await waitFor(() => assert.equal(document.activeElement, target))
  })

  it('opens with either keyboard context-menu shortcut and restores focus', async (t) => {
    let result = await mount(t, <Example />)
    let target = element(result.container, '[tabindex="0"]')
    let surface = element(result.container, '[popover]')
    let list = element(result.container, '[role="menu"]')

    target.focus()
    await result.act(() => {
      target.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'F10',
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      )
    })
    await waitFor(() => assert.equal(surface.matches(':popover-open'), true))
    await waitFor(() => assert.equal(document.activeElement, list))
    await result.act(() => key(list, 'Escape'))
    await waitFor(() => assert.equal(surface.matches(':popover-open'), false))
    await waitFor(() => assert.equal(document.activeElement, target))

    await result.act(() => key(target, 'ContextMenu'))
    await waitFor(() => assert.equal(surface.matches(':popover-open'), true))
    await waitFor(() => assert.equal(document.activeElement, list))
    await result.act(() => key(list, 'Escape'))
    await waitFor(() => assert.equal(surface.matches(':popover-open'), false))
    await waitFor(() => assert.equal(document.activeElement, target))
  })
})
