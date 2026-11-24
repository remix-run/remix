import * as assert from 'remix/assert'
import { render } from 'remix/component/test'
import { describe, it } from 'remix/test'

import { PendingButton } from './pending-button.tsx'

describe('PendingButton', () => {
  it('shows failure for two seconds without waiting for animation events', (t) => {
    let timers = t.useFakeTimers()
    let view = render(<PendingButton failed>Remove</PendingButton>)
    t.after(view.cleanup)
    let button = view.$('button')
    assert.ok(button)
    assert.equal(button.textContent, 'Failed!')

    timers.advance(400)
    view.root.flush()
    assert.equal(button.textContent, 'Failed!')
    view.root.render(
      <PendingButton failed aria-label="Remove album">
        Remove
      </PendingButton>,
    )
    view.root.flush()
    timers.advance(1600)
    view.root.flush()
    assert.equal(button.textContent, 'Remove')

    view.root.render(<PendingButton failed={false}>Remove</PendingButton>)
    view.root.flush()
    view.root.render(<PendingButton failed>Remove</PendingButton>)
    view.root.flush()
    assert.equal(button.textContent, 'Failed!')
    view.root.render(
      <PendingButton pending failed={false}>
        Remove
      </PendingButton>,
    )
    view.root.flush()
    timers.advance(2000)
    view.root.flush()
    assert.equal(button.textContent, 'Saving…')
  })
})
