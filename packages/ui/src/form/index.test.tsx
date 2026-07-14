import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { render } from '@remix-run/ui/test'

import { form } from './index.ts'

describe('form', () => {
  it('shows native invalid state only after the field loses focus', (t) => {
    let { $, cleanup } = render(
      <form mix={form()}>
        <input name="name" required />
      </form>,
    )
    t.after(cleanup)

    let input = $('input') as HTMLInputElement

    input.dispatchEvent(new InputEvent('input', { bubbles: true }))
    expect(input.hasAttribute('data-touched')).toBe(false)
    expect(input.hasAttribute('aria-invalid')).toBe(false)

    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    expect(input.hasAttribute('data-touched')).toBe(true)
    expect(input.getAttribute('aria-invalid')).toBe('true')

    input.value = 'Ada'
    input.dispatchEvent(new InputEvent('input', { bubbles: true }))
    expect(input.hasAttribute('aria-invalid')).toBe(false)
  })

  it('marks fields when native validation prevents submission', (t) => {
    let { $, cleanup } = render(
      <form mix={form()}>
        <input name="name" required />
      </form>,
    )
    t.after(cleanup)

    let formElement = $('form') as HTMLFormElement
    let input = $('input') as HTMLInputElement

    expect(formElement.checkValidity()).toBe(false)
    expect(input.hasAttribute('data-touched')).toBe(true)
    expect(input.getAttribute('aria-invalid')).toBe('true')
  })

  it('clears stale server error state after the field changes', (t) => {
    let { $, cleanup } = render(
      <form mix={form()}>
        <input
          aria-describedby="name-help name-error"
          aria-invalid="true"
          data-form-error-id="name-error"
          defaultValue="A"
          minLength={2}
          name="name"
        />
        <p id="name-help">Use your full name.</p>
        <p id="name-error">Name is too short.</p>
      </form>,
    )
    t.after(cleanup)

    let input = $('input') as HTMLInputElement
    let error = $('#name-error') as HTMLParagraphElement

    input.value = 'Ada'
    input.dispatchEvent(new InputEvent('input', { bubbles: true }))

    expect(input.hasAttribute('aria-invalid')).toBe(false)
    expect(input.getAttribute('aria-describedby')).toBe('name-help')
    expect(input.hasAttribute('data-form-error-id')).toBe(false)
    expect(error.hidden).toBe(true)
  })
})
