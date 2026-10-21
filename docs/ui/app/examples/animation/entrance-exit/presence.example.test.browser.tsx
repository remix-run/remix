import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './presence.example.tsx'
import {
  button,
  element,
  expectAnimation,
  finishAnimations,
  mount,
  waitFor,
} from '../../test-helpers.ts'

describe('Entrance and exit example', () => {
  it('keeps the notification mounted for exit and animates it when shown again', async (t) => {
    let result = await mount(t, <Example />)
    let other = await mount(t, <Example />)
    let toggle = button(result.container, 'Hide notification')
    let targetId = toggle.getAttribute('aria-controls')
    assert.ok(targetId)
    assert.equal(document.getElementById(targetId), element(result.container, '[id]'))
    assert.notEqual(
      targetId,
      button(other.container, 'Hide notification').getAttribute('aria-controls'),
    )
    await finishAnimations(result.container)
    let notification = element(result.container, '[role="status"]').parentElement
    assert.ok(notification)
    await result.act(() => button(result.container, 'Hide notification').click())
    assert.ok(result.$('[role="status"]'))
    await expectAnimation(notification)
    await waitFor(() => assert.equal(result.$('[role="status"]'), null))
    assert.equal(
      button(result.container, 'Show notification').getAttribute('aria-expanded'),
      'false',
    )
    await result.act(() => button(result.container, 'Show notification').click())
    notification = element(result.container, '[role="status"]').parentElement
    assert.ok(notification)
    await expectAnimation(notification)
    assert.ok(element(result.container, '[role="status"]').textContent?.includes('Changes saved'))
    assert.equal(
      button(result.container, 'Hide notification').getAttribute('aria-expanded'),
      'true',
    )
    await result.act(() => button(result.container, 'Hide notification').click())
    await expectAnimation(notification)
    await waitFor(() => assert.equal(result.$('[role="status"]'), null))
  })
})
