import pluralize from 'pluralize'
import { assert } from '@remix-run/assert'
import { describe, it, render } from '@remix-run/testing'

// This test file demonstrated that third party libraries are ok to import from within test modules

function ItemLabel(_handle: unknown) {
  return (props: { word: string; count: number }) => (
    <span data-testid="label">{pluralize(props.word, props.count, true)}</span>
  )
}

describe('ItemLabel (using pluralize)', () => {
  it('renders singular for count of 1', () => {
    let { $, cleanup } = render(<ItemLabel word="apple" count={1} />)
    assert.equal($('[data-testid="label"]')?.textContent, '1 apple')
    cleanup()
  })

  it('renders plural for count of 0', () => {
    let { $, cleanup } = render(<ItemLabel word="apple" count={0} />)
    assert.equal($('[data-testid="label"]')?.textContent, '0 apples')
    cleanup()
  })

  it('renders plural for count greater than 1', () => {
    let { $, cleanup } = render(<ItemLabel word="apple" count={3} />)
    assert.equal($('[data-testid="label"]')?.textContent, '3 apples')
    cleanup()
  })
})
