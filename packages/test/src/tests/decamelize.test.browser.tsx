import decamelize from 'decamelize'
import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { render } from '@remix-run/test/browser'

// This test file demonstrates that ESM third party libraries are ok to import from within test modules

function FieldLabel(_handle: unknown) {
  return (props: { name: string }) => (
    <span data-testid="label">{decamelize(props.name, { separator: ' ' })}</span>
  )
}

describe('FieldLabel (using decamelize)', () => {
  it('renders a single word unchanged', () => {
    let { $, cleanup } = render(<FieldLabel name="name" />)
    assert.equal($('[data-testid="label"]')?.textContent, 'name')
    cleanup()
  })

  it('converts camelCase to spaced words', () => {
    let { $, cleanup } = render(<FieldLabel name="firstName" />)
    assert.equal($('[data-testid="label"]')?.textContent, 'first name')
    cleanup()
  })

  it('handles multiple humps', () => {
    let { $, cleanup } = render(<FieldLabel name="dateOfBirth" />)
    assert.equal($('[data-testid="label"]')?.textContent, 'date of birth')
    cleanup()
  })
})
