import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { renderToString } from '@remix-run/component/server'
import { render } from '@remix-run/component/test'
import type { Handle } from '@remix-run/component'

import { createFormMixins, form, onInputValidation } from './form.ts'
import type { InputValidationEvent } from './form.ts'

describe('form', () => {
  it('reads live server errors before inputs render and supplies an attribute-only error mixin', async () => {
    type Submission = { errors: string[] }
    let submission: Submission | undefined
    let changes = 0
    let { input, error, errors } = createFormMixins(
      {
        fields: { email: {} },
        getInputAttrs(_field: 'email') {
          return { name: 'email', type: 'email' }
        },
        getErrorAttrs(_field: 'email') {
          return { id: 'email-error' }
        },
        getFieldErrors(_field: 'email', failed?: Submission) {
          return failed?.errors ?? []
        },
        createInputValidator(_field: 'email') {
          return (_input: HTMLInputElement) => {}
        },
      },
      {
        getSubmission: () => submission,
        onChange() {
          changes++
        },
      },
    )
    expect(errors.email).toEqual([])

    submission = { errors: ['Already registered'] }
    let html = await renderToString(
      <>
        <p mix={error('email')} role="alert">
          {errors.email.join(' ')}
        </p>
        <input mix={input('email')} />
      </>,
    )
    expect(html).toContain('id="email-error"')
    expect(html).toContain('Already registered')
    expect(html).toContain('role="alert"')
    expect(html).toContain('aria-describedby="email-error"')

    submission = { errors: ['Try another address'] }
    expect(errors.email).toEqual(['Try another address'])
    submission = undefined
    expect(errors.email).toEqual([])
    expect(changes).toBe(0)

    let overridden = await renderToString(
      <p id="custom-error" hidden mix={error('email')}>
        Application content
      </p>,
    )
    expect(overridden).toContain('id="custom-error"')
    expect(overridden).toContain('hidden')
    expect(overridden).toContain('Application content')
    expect(overridden).not.toContain('role=')
  })

  it('renders live errors through onChange without manual event or submission bookkeeping', (t) => {
    let changes = 0
    function Example(handle: Handle) {
      let { form, input, error, errors } = createFormMixins(
        {
          fields: { username: {} },
          getInputAttrs(_field: 'username') {
            return { name: 'username', required: true }
          },
          getErrorAttrs(_field: 'username') {
            return { id: 'username-error' }
          },
          getFieldErrors(_field: 'username') {
            return []
          },
          createInputValidator(_field: 'username') {
            return (input: HTMLInputElement) => {
              input.setCustomValidity(input.value.startsWith('@') ? '' : 'Start with @')
            }
          },
        },
        {
          onChange() {
            changes++
            handle.update()
          },
        },
      )
      return () => (
        <form mix={form()}>
          {errors.username.length > 0 ? (
            <p mix={error('username')} role="alert">
              {errors.username.join(' ')}
            </p>
          ) : null}
          <input mix={input('username')} />
        </form>
      )
    }
    let { container, root, cleanup } = render(<Example />)
    t.after(cleanup)
    let input = container.querySelector('input')
    let form = container.querySelector('form')
    if (!input || !form) throw new Error('Missing form markup')

    input.value = 'ada'
    input.dispatchEvent(new InputEvent('input', { bubbles: true }))
    root.flush()
    expect(container.querySelector('p')).toBe(null)
    expect(changes).toBe(0)

    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    root.flush()
    expect(container.querySelector('p')?.textContent).toBe('Start with @')
    expect(input.getAttribute('aria-describedby')).toBe(container.querySelector('p')?.id)
    expect(changes).toBe(1)

    input.value = 'grace'
    input.dispatchEvent(new InputEvent('input', { bubbles: true }))
    root.flush()
    expect(changes).toBe(1)

    input.value = '@ada'
    input.dispatchEvent(new InputEvent('input', { bubbles: true }))
    root.flush()
    expect(container.querySelector('p')).toBe(null)
    expect(input.hasAttribute('aria-describedby')).toBe(false)
    expect(changes).toBe(2)

    input.value = ''
    expect(form.checkValidity()).toBe(false)
    root.flush()
    expect(container.querySelector('p')?.textContent).toBe(input.validationMessage)
    expect(changes).toBe(3)
  })

  it('keeps bindings independent and updates read-only errors without a form mixin', (t) => {
    let definition = {
      fields: { name: {} },
      getInputAttrs(_field: 'name') {
        return { name: 'name', required: true }
      },
      getErrorAttrs(_field: 'name') {
        return { id: 'name-error' }
      },
      getFieldErrors(_field: 'name') {
        return []
      },
      createInputValidator(_field: 'name') {
        return (_input: HTMLInputElement) => {}
      },
    }
    let changes = 0
    let first = createFormMixins(definition, { onChange: () => changes++ })
    let second = createFormMixins(definition)
    let errors = first.errors
    let { container, cleanup } = render(
      <>
        <input id="first" mix={first.input('name')} />
        <input id="second" mix={second.input('name')} />
      </>,
    )
    t.after(cleanup)
    let input = container.querySelector('input')
    if (!input) throw new Error('Missing input')

    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    expect(errors.name).toEqual([input.validationMessage])
    expect(second.errors.name).toEqual([])
    expect(changes).toBe(1)
    expect(Reflect.set(errors, 'name', ['Replacement'])).toBe(false)

    input.value = 'Ada'
    input.dispatchEvent(new InputEvent('input', { bubbles: true }))
    expect(first.errors).toBe(errors)
    expect(errors.name).toEqual([])
    expect(changes).toBe(2)
  })

  it('applies generated input attributes during SSR while preserving explicit props', async () => {
    let submission: { name?: string } | undefined
    let { input } = createFormMixins(
      {
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
        getErrorAttrs(_field: 'name') {
          return { id: 'name-error' }
        },
        getFieldErrors(_field: 'name') {
          return []
        },
      },
      { getSubmission: () => submission },
    )

    let inputMixin = input('name')
    submission = { name: 'Ada' }

    let html = await renderToString(
      <input mix={inputMixin} placeholder="Full name" type="search" />,
    )

    expect(html).toContain('id="name"')
    expect(html).toContain('name="name"')
    expect(html).toContain('required')
    expect(html).toContain('minlength="2"')
    expect(html).toContain('value="Ada"')
    expect(html).toContain('placeholder="Full name"')
    expect(html).toContain('type="search"')

    submission = { name: 'Grace' }
    let nextHtml = await renderToString(<input mix={inputMixin} />)
    expect(nextHtml).toContain('value="Grace"')
  })

  it('owns validation and touched feedback without a form mixin', (t) => {
    let validation = createFormMixins({
      fields: { username: {} },
      getInputAttrs(_field: 'username') {
        return { id: 'username', name: 'username', required: true }
      },
      createInputValidator(_field: 'username') {
        return (input: HTMLInputElement) => {
          input.setCustomValidity(input.value.startsWith('@') ? '' : 'Start with @')
        }
      },
      getErrorAttrs(_field: 'username') {
        return { id: 'username-error' }
      },
      getFieldErrors(_field: 'username') {
        return []
      },
    })
    let { $, cleanup } = render(
      <form>
        <input mix={validation.input('username')} />
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
    expect(input.getAttribute('aria-describedby')).toBe('username-error')

    input.value = '@ada'
    input.dispatchEvent(new InputEvent('input', { bubbles: true }))
    expect(input.validationMessage).toBe('')
    expect(input.hasAttribute('aria-invalid')).toBe(false)
    expect(input.hasAttribute('aria-describedby')).toBe(false)
  })

  it('emits presentation-ready errors while preserving help text and user-owned error UI', (t) => {
    let events: InputValidationEvent[] = []
    let validation = createFormMixins({
      fields: { username: {} },
      getInputAttrs(_field: 'username') {
        return { id: 'username', name: 'username', required: true }
      },
      getErrorAttrs(_field: 'username') {
        return { id: 'username-error' }
      },
      getFieldErrors(_field: 'username') {
        return []
      },
      createInputValidator(_field: 'username') {
        return (input: HTMLInputElement) => {
          input.setCustomValidity(input.value.startsWith('@') ? '' : 'Start with @')
        }
      },
    })
    let { container, root, cleanup } = render(
      <form
        mix={[
          validation.form(),
          onInputValidation((event) => {
            events.push(event)
          }),
        ]}
      >
        <input aria-describedby="username-help" mix={validation.input('username')} />
        <p id="username-error">Application-owned markup</p>
      </form>,
    )
    t.after(cleanup)
    let input = container.querySelector('input')
    if (!input) throw new Error('Missing input')

    input.value = 'ada'
    input.dispatchEvent(new InputEvent('input', { bubbles: true }))
    expect(events.at(-1)?.errors).toEqual([])
    expect(events.at(-1)?.touched).toBe(false)
    expect(input.getAttribute('aria-describedby')).toBe('username-help')

    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    root.flush()
    expect(events.at(-1)?.field).toBe('username')
    expect(events.at(-1)?.errorId).toBe('username-error')
    expect(events.at(-1)?.errors).toEqual(['Start with @'])
    expect(events.at(-1)?.touched).toBe(true)
    expect(input.getAttribute('aria-describedby')).toBe('username-help username-error')
    expect(container.querySelector('p')?.textContent).toBe('Application-owned markup')

    input.value = '@ada'
    input.dispatchEvent(new InputEvent('input', { bubbles: true }))
    root.flush()
    expect(events.at(-1)?.errors).toEqual([])
    expect(input.getAttribute('aria-describedby')).toBe('username-help')
    expect(input.hasAttribute('aria-invalid')).toBe(false)
  })

  it('preserves server feedback until editing without hiding the error element', async (t) => {
    let events: InputValidationEvent[] = []
    let submission = { errors: ['Already registered'] }
    let validation = createFormMixins(
      {
        fields: { email: {} },
        getInputAttrs(_field: 'email', failed?: typeof submission) {
          return {
            id: 'email',
            name: 'email',
            type: 'email',
            defaultValue: 'ada@example.com',
            'aria-invalid': failed ? 'true' : undefined,
            'aria-describedby': failed ? 'email-error' : undefined,
            'data-form-error-id': failed ? 'email-error' : undefined,
          }
        },
        getErrorAttrs(_field: 'email') {
          return { id: 'email-error' }
        },
        getFieldErrors(_field: 'email', failed?: typeof submission) {
          return failed?.errors ?? []
        },
        createInputValidator(_field: 'email') {
          return (_input: HTMLInputElement) => {}
        },
      },
      { getSubmission: () => submission },
    )
    let html = await renderToString(<input mix={validation.input('email')} />)
    expect(html).toContain('value="ada@example.com"')
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('aria-describedby="email-error"')
    let { container, root, cleanup } = render(
      <form
        mix={[
          validation.form(),
          onInputValidation((event) => {
            events.push(event)
          }),
        ]}
      >
        <input mix={validation.input('email')} />
        <p id="email-error">Already registered</p>
      </form>,
    )
    t.after(cleanup)
    let input = container.querySelector('input')
    let error = container.querySelector('p')
    if (!input || !error) throw new Error('Missing field markup')

    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    expect(events.at(-1)?.errors).toEqual(['Already registered'])

    input.value = 'invalid'
    input.dispatchEvent(new InputEvent('input', { bubbles: true }))
    root.flush()
    expect(events.at(-1)?.errors).toEqual([input.validationMessage])
    expect(input.getAttribute('aria-describedby')).toBe('email-error')
    expect(input.hasAttribute('data-form-error-id')).toBe(false)
    expect(error.hidden).toBe(false)
    expect(error.textContent).toBe('Already registered')
  })

  it('uses native constraints before supplemental schema validation', (t) => {
    let validations = 0
    let validation = createFormMixins({
      fields: { email: {} },
      getInputAttrs(_field: 'email') {
        return { name: 'email', type: 'email', required: true }
      },
      getErrorAttrs(_field: 'email') {
        return { id: 'email-error' }
      },
      getFieldErrors(_field: 'email') {
        return []
      },
      createInputValidator(_field: 'email') {
        return (input: HTMLInputElement) => {
          validations++
          input.setCustomValidity(input.value.endsWith('@example.com') ? '' : 'Use example.com')
        }
      },
    })
    let { container, cleanup } = render(<input mix={validation.input('email')} />)
    t.after(cleanup)
    let input = container.querySelector('input')
    if (!input) throw new Error('Missing input')

    expect(validations).toBe(0)
    expect(input.validity.valueMissing).toBe(true)
    input.value = 'invalid'
    input.dispatchEvent(new InputEvent('input', { bubbles: true }))
    expect(validations).toBe(0)
    expect(input.validity.typeMismatch).toBe(true)
    expect(input.validity.customError).toBe(false)

    input.value = 'ada@other.com'
    input.dispatchEvent(new InputEvent('input', { bubbles: true }))
    expect(validations).toBe(1)
    expect(input.validationMessage).toBe('Use example.com')

    input.value = ''
    input.dispatchEvent(new InputEvent('input', { bubbles: true }))
    expect(input.validity.valueMissing).toBe(true)
    expect(input.validity.customError).toBe(false)
  })

  it('validates restored custom values and reveals errors when native validation blocks submission', (t) => {
    let events: InputValidationEvent[] = []
    let validation = createFormMixins({
      fields: { username: {}, terms: {} },
      getInputAttrs(field: 'username' | 'terms') {
        return field === 'username'
          ? { id: field, name: field, defaultValue: 'ada' }
          : { id: field, name: field, type: 'checkbox', required: true }
      },
      getErrorAttrs(field: 'username' | 'terms') {
        return { id: `${field}-error` }
      },
      getFieldErrors(_field: 'username' | 'terms') {
        return []
      },
      createInputValidator(field: 'username' | 'terms') {
        return (input: HTMLInputElement) => {
          input.setCustomValidity(
            field === 'username' && !input.value.startsWith('@') ? 'Start with @' : '',
          )
        }
      },
    })
    let { container, cleanup } = render(
      <form
        mix={[
          validation.form(),
          onInputValidation((event) => {
            events.push(event)
          }),
        ]}
      >
        <input mix={validation.input('username')} />
        <input mix={validation.input('terms')} />
      </form>,
    )
    t.after(cleanup)
    let element = container.querySelector('form')
    let username = container.querySelector('input[name="username"]')
    let terms = container.querySelector('input[name="terms"]')
    if (!element || !username || !terms) throw new Error('Missing form markup')

    expect(username.hasAttribute('aria-invalid')).toBe(false)
    expect(element.checkValidity()).toBe(false)
    expect(username.getAttribute('aria-invalid')).toBe('true')
    expect(terms.getAttribute('aria-invalid')).toBe('true')
    expect(events.map((event) => event.field)).toEqual(['username', 'terms'])
    expect(events[0]?.errors).toEqual(['Start with @'])
    expect(events[1]?.errors.length).toBe(1)
  })

  it('keeps edited feedback through rerenders and accepts a new server submission', (t) => {
    type Submission = { errors: string[] }
    let submission: Submission = { errors: ['Already registered'] }
    let setups = 0

    function Example(handle: Handle<{ submission?: Submission }>) {
      setups++
      let { form, input, error, errors } = createFormMixins(
        {
          fields: { email: {} },
          getInputAttrs(_field: 'email', failed?: Submission) {
            return { name: 'email', 'aria-describedby': failed ? 'email-error' : undefined }
          },
          getErrorAttrs(_field: 'email') {
            return { id: 'email-error' }
          },
          getFieldErrors(_field: 'email', failed?: Submission) {
            return failed?.errors ?? []
          },
          createInputValidator(_field: 'email') {
            return (_input: HTMLInputElement) => {}
          },
        },
        {
          getSubmission: () => handle.props.submission,
          onChange: () => handle.update(),
        },
      )
      let inputMixin = input('email')

      return () => (
        <form mix={form()}>
          {errors.email.length > 0 ? <p mix={error('email')}>{errors.email.join(' ')}</p> : null}
          <input mix={inputMixin} />
          <input name="unmanaged" required />
        </form>
      )
    }

    let { container, root, cleanup } = render(<Example submission={submission} />)
    t.after(cleanup)
    let input = container.querySelector('input')
    if (!input) throw new Error('Missing input')
    expect(container.querySelector('p')?.textContent).toBe('Already registered')

    input.dispatchEvent(new InputEvent('input', { bubbles: true }))
    root.flush()
    expect(input.hasAttribute('aria-invalid')).toBe(false)
    expect(container.querySelector('p')).toBe(null)
    root.render(<Example submission={submission} />)
    root.flush()
    expect(input.hasAttribute('aria-invalid')).toBe(false)
    expect(input.hasAttribute('aria-describedby')).toBe(false)

    submission = { errors: ['Try another address'] }
    root.render(<Example submission={submission} />)
    root.flush()
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toBe('email-error')
    expect(container.querySelector('p')?.textContent).toBe('Try another address')

    let unmanaged = container.querySelector('input[name="unmanaged"]')
    if (!unmanaged) throw new Error('Missing unmanaged input')
    unmanaged.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    expect(unmanaged.getAttribute('aria-invalid')).toBe('true')

    root.render(<Example />)
    root.flush()
    expect(input.hasAttribute('aria-invalid')).toBe(false)
    expect(input.hasAttribute('aria-describedby')).toBe(false)
    expect(input.hasAttribute('data-touched')).toBe(false)
    expect(container.querySelector('p')).toBe(null)
    expect(setups).toBe(1)
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
