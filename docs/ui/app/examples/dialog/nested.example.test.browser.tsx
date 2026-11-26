import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Nested from './nested.example.tsx'
import { button, element, key, mount, waitFor } from '../test-helpers.ts'

describe('Dialog nested example', () => {
  it('dismisses the nested dialog before its parent and restores its opener', async (t) => {
    let view = await mount(t, <Nested />)
    await view.act(() => button(view.container, 'Open dialog').click())
    let parent = element(document.body, '[role="dialog"][data-open]')
    let trigger = button(parent, 'Open nested dialog')
    await view.act(() => trigger.click())
    let child = element(document.body, '[role="dialog"][data-nested][data-open]')
    await waitFor(() => assert.equal(document.activeElement, button(child, 'Close')))
    await view.act(() => key(button(child, 'Close'), 'Escape'))
    await waitFor(() => assert.equal(child.hasAttribute('data-open'), false))
    assert.equal(parent.hasAttribute('data-open'), true)
    assert.equal(document.activeElement, trigger)
    await view.act(() => button(parent, 'Close').click())
    await waitFor(() => assert.equal(parent.hasAttribute('data-open'), false))
  })
})

describe('Dialog nested styling', () => {
  it('scales three nested dialogs using their open descendant depths and restores each parent', async (t) => {
    let view = await mount(t, <Nested />)
    await view.act(() => button(view.container, 'Open dialog').click())
    let parent = element(document.body, '[role="dialog"][data-open]')
    await view.act(() => button(parent, 'Open nested dialog').click())
    let child = element(document.body, '[role="dialog"][data-nested][data-open]')
    await view.act(() => button(child, 'Open third dialog').click())
    let front = [...document.body.querySelectorAll<HTMLElement>('[role="dialog"][data-open]')].find(
      (surface) => surface.querySelector('h2')?.textContent === 'Third dialog',
    )
    assert.ok(front)
    await waitFor(() => {
      assert.equal(getComputedStyle(parent).getPropertyValue('--dialog-open-descendant-depth'), '2')
      assert.equal(getComputedStyle(child).getPropertyValue('--dialog-open-descendant-depth'), '1')
      assert.equal(getComputedStyle(front).getPropertyValue('--dialog-open-descendant-depth'), '0')
      assert.equal(getComputedStyle(parent).scale, '0.86')
      assert.equal(getComputedStyle(child).scale, '0.93')
      assert.equal(getComputedStyle(front).scale, '1')
    })
    let backdrops = [
      ...document.body.querySelectorAll<HTMLElement>('[aria-hidden="true"][data-open]'),
    ]
    assert.equal(backdrops.length, 3)
    await waitFor(() => {
      assert.equal(backdrops[0].hasAttribute('data-nested'), false)
      assert.equal(backdrops[1].hasAttribute('data-nested'), true)
      assert.equal(backdrops[2].hasAttribute('data-nested'), true)
      assert.equal(getComputedStyle(backdrops[0]).opacity, '1')
      assert.equal(getComputedStyle(backdrops[1]).opacity, '0')
      assert.equal(getComputedStyle(backdrops[2]).opacity, '0')
    })
    await view.act(() => button(front, 'Close').click())
    await waitFor(() => {
      assert.equal(front.hasAttribute('data-open'), false)
      assert.equal(getComputedStyle(parent).scale, '0.93')
      assert.equal(getComputedStyle(child).scale, '1')
    })
    await view.act(() => button(child, 'Close').click())
    await waitFor(() => {
      assert.equal(child.hasAttribute('data-open'), false)
      assert.equal(getComputedStyle(parent).scale, '1')
      assert.equal(parent.hasAttribute('data-child-dialog-open'), false)
    })
  })
})
