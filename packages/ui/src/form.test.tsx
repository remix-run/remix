import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { renderToString } from '@remix-run/component/server'
import { render } from '@remix-run/component/test'

import { createInputMixin, form } from './form.ts'

describe('form', () => {
  it('applies generated input attributes during SSR while preserving explicit props', async () => {
    let nameInput = createInputMixin({
      fields: { name: {} },
      getInputAttrs(_field: 'name', submission?: { name?: string }) {
        return {
          id: 'name',
          name: 'name',
          type: 'text',
          required: true,
          minLength: 2,
          defaultValue: submission?.name,
        }
      },
      createInputValidator(_field: 'name') {
        return (_input: HTMLInputElement) => {}
      },
    })

    let html = await renderToString(
      <input mix={nameInput('name', { name: 'Ada' })} placeholder="Full name" type="search" />,
    )

    expect(html).toContain('id="name"')
    expect(html).toContain('name="name"')
    expect(html).toContain('required')
    expect(html).toContain('minlength="2"')
    expect(html).toContain('value="Ada"')
    expect(html).toContain('placeholder="Full name"')
    expect(html).toContain('type="search"')
  })

  it('runs field schema validation before the form synchronizes touched state', (t) => {
    let usernameInput = createInputMixin({
      fields: { username: {} },
      getInputAttrs(_field: 'username') {
        return { id: 'username', name: 'username', required: true }
      },
      createInputValidator(_field: 'username') {
        return (input: HTMLInputElement) => {
          input.setCustomValidity(input.value.startsWith('@') ? '' : 'Start with @')
        }
      },
    })
    let { $, cleanup } = render(
      <form mix={form()}>
        <input mix={usernameInput('username')} />
      </form>,
    )
    t.after(cleanup)

    let input = $('input') as HTMLInputElement

    input.value = 'ada'
    input.dispatchEvent(new InputEvent('input', { bubbles: true }))
    expect(input.validationMessage).toBe('Start with @')
    expect(input.hasAttribute('aria-invalid')).toBe(false)

    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    expect(input.getAttribute('aria-invalid')).toBe('true')

    input.value = '@ada'
    input.dispatchEvent(new InputEvent('input', { bubbles: true }))
    expect(input.validationMessage).toBe('')
    expect(input.hasAttribute('aria-invalid')).toBe(false)
  })

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
