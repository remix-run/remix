import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import Example from './presence.example.tsx'
import { button, expectAnimation, finishAnimations, mount, waitFor } from '../../test-helpers.ts'

describe('Layout with entrance and exit example', () => {
  it('animates remaining notifications while a dismissed notification exits', async (t) => {
    let result = await mount(t, <Example />)
    await finishAnimations(result.container)
    let departing = button(result.container, 'Dismiss Changes saved').closest('li')
    let remaining = button(result.container, 'Dismiss Export ready').closest('li')
    assert.ok(departing && remaining)

    await result.act(() => button(result.container, 'Dismiss Changes saved').click())
    assert.equal(departing.isConnected, true)
    await Promise.all([
      expectAnimation(departing, 'opacity'),
      expectAnimation(remaining, 'transform'),
    ])
    await waitFor(() => assert.equal(departing.isConnected, false))
    assert.equal(remaining.isConnected, true)
  })
})
