import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { renderToString } from '@remix-run/component/server'
import { render } from '@remix-run/component/test'
import type { Handle } from '@remix-run/component'

import { createFieldMixins, createFormMixins, form, onInputValidation } from './form.ts'
import type { InputValidationEvent } from './form.ts'

type TestControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

describe('createFieldMixins', () => {
  it('provides label mixins with custom ids during SSR and client rendering', async (t) => {
    let changes = 0
    let { field, label } = createFieldMixins(
      {
        getInputAttrs() {
          return { id: 'contact-email', name: 'contact.email', type: 'email' }
        },
        getLabelAttrs() {
          return { htmlFor: 'contact-email' }
        },
        getErrorAttrs() {
          return { id: 'contact-email-error' }
        },
        getFieldErrors() {
          return []
        },
        createInputValidator() {
          return (_control: TestControl) => {}
        },
      },
      { name: 'email', onChange: () => changes++ },
    )
    let markup = (
      <>
        <label mix={label()}>Email address</label>
        <input mix={field()} />
      </>
    )
    let html = await renderToString(markup)
    expect(html).toContain('<label for="contact-email">Email address</label>')
    expect(html).toContain('id="contact-email"')
    let { container, cleanup } = render(markup)
    t.after(cleanup)
    let labelElement = container.querySelector('label')
    let input = container.querySelector('input')
    if (!labelElement || !input) throw new Error('Missing label or input')
    expect(labelElement.control).toBe(input)
    expect(changes).toBe(0)

    let overridden = await renderToString(
      <label htmlFor="other-control" title="Application title" mix={label()}>
        Application label
      </label>,
    )
    expect(overridden).toContain('for="other-control"')
    expect(overridden).toContain('title="Application title"')
    expect(overridden).toContain('Application label')
    expect(overridden).not.toContain('role=')
  })

  it('exposes independent live touched state and notifies on first blur, not valid edits', (t) => {
    let changes = 0
    let definition = {
      getInputAttrs(name: string) {
        return { name, defaultValue: 'Ada' }
      },
      getLabelAttrs(name: string) {
        return { htmlFor: name }
      },
      getErrorAttrs(name: string) {
        return { id: `${name}-error` }
      },
      getFieldErrors() {
        return []
      },
      createInputValidator() {
        return (_control: { setCustomValidity(message: string): void }) => {}
      },
    }
    let first = createFieldMixins(definition, { name: 'first', onChange: () => changes++ })
    let second = createFieldMixins(definition, { name: 'second' })
    let { container, cleanup } = render(
      <form>
        <input mix={first.field()} />
        <input mix={second.field()} />
      </form>,
    )
    t.after(cleanup)
    let control = container.querySelector('input')
    if (!control) throw new Error('Missing input')
    expect(first.touched).toBe(false)
    control.value = 'Grace'
    control.dispatchEvent(new Event('input', { bubbles: true }))
    expect(first.touched).toBe(false)
    expect(changes).toBe(0)
    control.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    expect(first.touched).toBe(true)
    expect(first.errors).toEqual([])
    expect(changes).toBe(1)
    control.value = 'Ada'
    control.dispatchEvent(new Event('input', { bubbles: true }))
    control.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    expect(first.touched).toBe(true)
    expect(changes).toBe(1)
    expect(second.touched).toBe(false)
    expect(Reflect.set(first, 'touched', false)).toBe(false)
  })

  it('supports select, textarea, checkbox, native invalid events, and reset', async (t) => {
    let definition = {
      getInputAttrs(name: string) {
        return { name, required: true }
      },
      getLabelAttrs(name: string) {
        return { htmlFor: name }
      },
      getErrorAttrs(name: string) {
        return { id: `${name}-error` }
      },
      getFieldErrors() {
        return []
      },
      createInputValidator() {
        return (_control: { setCustomValidity(message: string): void }) => {}
      },
    }
    let choice = createFieldMixins(definition, { name: 'choice' })
    let bio = createFieldMixins(definition, { name: 'bio' })
    let terms = createFieldMixins(definition, { name: 'terms' })
    let { container, cleanup } = render(
      <form>
        <select mix={choice.field()}>
          <option value="">Choose</option>
          <option value="a">A</option>
        </select>
        <textarea mix={bio.field()} />
        <input type="checkbox" mix={terms.field()} />
      </form>,
    )
    t.after(cleanup)
    let form = container.querySelector('form')
    let select = container.querySelector('select')
    let textarea = container.querySelector('textarea')
    let checkbox = container.querySelector('input')
    if (!form || !select || !textarea || !checkbox) throw new Error('Missing controls')
    expect(form.checkValidity()).toBe(false)
    expect(choice.touched).toBe(true)
    expect(bio.touched).toBe(true)
    expect(terms.touched).toBe(true)
    expect(bio.errors.length).toBe(1)
    select.value = 'a'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    textarea.value = 'Hello'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    checkbox.checked = true
    checkbox.dispatchEvent(new Event('change', { bubbles: true }))
    expect(choice.errors).toEqual([])
    expect(bio.errors).toEqual([])
    expect(terms.errors).toEqual([])
    expect(form.checkValidity()).toBe(true)
    form.reset()
    await Promise.resolve()
    expect(choice.touched).toBe(false)
    expect(bio.touched).toBe(false)
    expect(terms.touched).toBe(false)
    expect(bio.errors).toEqual([])
    expect(textarea.value).toBe('')
  })

  it('resets touched state for a new submission without notifying', (t) => {
    type Submission = { value: string; errors: string[] }
    let submission: Submission = { value: 'Ada', errors: ['Already registered'] }
    let changes = 0
    let field = createFieldMixins(
      {
        getInputAttrs(name: string, submission?: Submission) {
          return { name, defaultValue: submission?.value }
        },
        getLabelAttrs(name: string) {
          return { htmlFor: name }
        },
        getErrorAttrs(name: string) {
          return { id: `${name}-error` }
        },
        getFieldErrors(_name: string, submission?: Submission) {
          return submission?.errors ?? []
        },
        createInputValidator() {
          return (_control: TestControl) => {}
        },
      },
      { name: 'name', getSubmission: () => submission, onChange: () => changes++ },
    )
    let { container, root, cleanup } = render(<input mix={field.field()} />)
    t.after(cleanup)
    let input = container.querySelector('input')
    if (!input) throw new Error('Missing input')
    expect(field.errors).toEqual(['Already registered'])
    expect(field.touched).toBe(false)
    input.value = 'Grace'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(field.touched).toBe(true)
    expect(field.errors).toEqual([])
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    expect(changes).toBe(1)

    submission = { value: 'Lin', errors: ['Try again'] }
    expect(field.touched).toBe(false)
    expect(field.errors).toEqual(['Try again'])
    expect(changes).toBe(1)
    root.render(<input mix={field.field()} />)
    root.flush()
    input.value = 'Other'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(field.touched).toBe(true)
    expect(field.errors).toEqual([])
    expect(changes).toBe(2)
  })

  it('keeps state after a canceled reset and preserves textarea defaults during SSR', async (t) => {
    let field = createFieldMixins(
      {
        getInputAttrs(name: string) {
          return { name, type: 'text', defaultValue: 'Original', required: true }
        },
        getLabelAttrs(name: string) {
          return { htmlFor: name }
        },
        getErrorAttrs(name: string) {
          return { id: `${name}-error` }
        },
        getFieldErrors() {
          return []
        },
        createInputValidator() {
          return (_control: TestControl) => {}
        },
      },
      { name: 'bio' },
    )
    let html = await renderToString(<textarea mix={field.field()} />)
    expect(html).toContain('>Original</textarea>')
    expect(html).not.toContain('type=')
    let selectHtml = await renderToString(
      <select mix={field.field()}>
        <option value="Original" selected>
          Original
        </option>
      </select>,
    )
    expect(selectHtml).not.toContain('type=')
    expect(selectHtml.toLowerCase()).not.toContain('defaultvalue=')
    expect(selectHtml).toContain('selected')
    let { container, cleanup } = render(
      <form>
        <textarea mix={field.field()} />
      </form>,
    )
    t.after(cleanup)
    let form = container.querySelector('form')
    let textarea = container.querySelector('textarea')
    if (!form || !textarea) throw new Error('Missing controls')
    textarea.value = 'Edited'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    textarea.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    form.addEventListener('reset', (event) => event.preventDefault())
    form.reset()
    await Promise.resolve()
    expect(textarea.value).toBe('Edited')
    expect(field.touched).toBe(true)
  })
})

describe('form', () => {
  it('provides field-specific label mixins that can be destructured', async (t) => {
    let { field, label } = createFormMixins({
      fields: { email: {}, password: {} },
      getInputAttrs(name: 'email' | 'password') {
        return { id: `signup-${name}`, name }
      },
      getLabelAttrs(name: 'email' | 'password') {
        return { htmlFor: `signup-${name}` }
      },
      getErrorAttrs(name: 'email' | 'password') {
        return { id: `signup-${name}-error` }
      },
      getFieldErrors() {
        return []
      },
      createInputValidator() {
        return (_control: TestControl) => {}
      },
    })
    let markup = (
      <>
        <label mix={label('email')}>Email</label>
        <input mix={field('email')} />
        <label mix={label('password')}>Password</label>
        <input mix={field('password')} />
      </>
    )
    let html = await renderToString(markup)
    expect(html).toContain('<label for="signup-email">Email</label>')
    expect(html).toContain('<label for="signup-password">Password</label>')
    let { container, cleanup } = render(markup)
    t.after(cleanup)
    let labels = container.querySelectorAll('label')
    let inputs = container.querySelectorAll('input')
    expect(labels[0].control).toBe(inputs[0])
    expect(labels[1].control).toBe(inputs[1])
    let overridden = await renderToString(
      <label htmlFor="other-control" mix={label('email')}>
        Other
      </label>,
    )
    expect(overridden).toContain('for="other-control"')
  })

  it('reads live server errors before inputs render and supplies an attribute-only error mixin', async () => {
    type Submission = { errors: string[] }
    let submission: Submission | undefined
    let changes = 0
    let { input, error, errors, fields } = createFormMixins(
      {
        fields: { email: {} },
        getInputAttrs(_field: 'email') {
          return { name: 'email', type: 'email' }
        },
        getLabelAttrs(_field: 'email') {
          return { htmlFor: 'email' }
        },
        getErrorAttrs(_field: 'email') {
          return { id: 'email-error' }
        },
        getFieldErrors(_field: 'email', failed?: Submission) {
          return failed?.errors ?? []
        },
        createInputValidator(_field: 'email') {
          return (_input: TestControl) => {}
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
    let emailState = fields.email
    expect(emailState.touched).toBe(false)

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
    expect(fields.email).toBe(emailState)
    expect(emailState.errors).toBe(errors.email)
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
          getLabelAttrs(_field: 'username') {
            return { htmlFor: 'username' }
          },
          getErrorAttrs(_field: 'username') {
            return { id: 'username-error' }
          },
          getFieldErrors(_field: 'username') {
            return []
          },
          createInputValidator(_field: 'username') {
            return (input: TestControl) => {
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
      getLabelAttrs(_field: 'name') {
        return { htmlFor: 'name' }
      },
      getErrorAttrs(_field: 'name') {
        return { id: 'name-error' }
      },
      getFieldErrors(_field: 'name') {
        return []
      },
      createInputValidator(_field: 'name') {
        return (_input: TestControl) => {}
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
          return (_input: TestControl) => {}
        },
        getLabelAttrs(_field: 'name') {
          return { htmlFor: 'name' }
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
        return (input: TestControl) => {
          input.setCustomValidity(input.value.startsWith('@') ? '' : 'Start with @')
        }
      },
      getLabelAttrs(_field: 'username') {
        return { htmlFor: 'username' }
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
      getLabelAttrs(_field: 'username') {
        return { htmlFor: 'username' }
      },
      getErrorAttrs(_field: 'username') {
        return { id: 'username-error' }
      },
      getFieldErrors(_field: 'username') {
        return []
      },
      createInputValidator(_field: 'username') {
        return (input: TestControl) => {
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
        getLabelAttrs(_field: 'email') {
          return { htmlFor: 'email' }
        },
        getErrorAttrs(_field: 'email') {
          return { id: 'email-error' }
        },
        getFieldErrors(_field: 'email', failed?: typeof submission) {
          return failed?.errors ?? []
        },
        createInputValidator(_field: 'email') {
          return (_input: TestControl) => {}
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
      getLabelAttrs(_field: 'email') {
        return { htmlFor: 'email' }
      },
      getErrorAttrs(_field: 'email') {
        return { id: 'email-error' }
      },
      getFieldErrors(_field: 'email') {
        return []
      },
      createInputValidator(_field: 'email') {
        return (input: TestControl) => {
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
      getLabelAttrs(field: 'username' | 'terms') {
        return { htmlFor: field }
      },
      getErrorAttrs(field: 'username' | 'terms') {
        return { id: `${field}-error` }
      },
      getFieldErrors(_field: 'username' | 'terms') {
        return []
      },
      createInputValidator(field: 'username' | 'terms') {
        return (input: TestControl) => {
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
          getLabelAttrs(_field: 'email') {
            return { htmlFor: 'email' }
          },
          getErrorAttrs(_field: 'email') {
            return { id: 'email-error' }
          },
          getFieldErrors(_field: 'email', failed?: Submission) {
            return failed?.errors ?? []
          },
          createInputValidator(_field: 'email') {
            return (_input: TestControl) => {}
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
