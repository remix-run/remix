import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { renderToString } from '@remix-run/component/server'
import { render } from '@remix-run/component/test'
import type { Handle } from '@remix-run/component'
import * as s from '@remix-run/data-schema'
import * as fd from '@remix-run/data-schema/form'
import { email, minLength, min, max } from '@remix-run/data-schema/checks'
import * as form from './form.ts'
import type { FieldBinding } from './form.ts'
import { renderForm, input, edit, blur } from './test/form.tsx'

describe('form.Context', () => {
  it('restores native string controls and numeric ranges without projecting unrelated constraints', async (t) => {
    let values = {
      date: '2026-11-04',
      month: '2026-11',
      week: '2026-W45',
      time: '09:30',
      'datetime-local': '2026-11-04T09:30',
      color: '#123456',
      hidden: 'original',
      range: '4',
    }
    let schema = fd.object({
      date: fd.text(s.string()),
      month: fd.text(s.string()),
      week: fd.text(s.string()),
      time: fd.text(s.string()),
      'datetime-local': fd.text(s.string()),
      color: fd.text(s.string().pipe(minLength(7))),
      hidden: fd.text(s.string().pipe(minLength(20))),
      range: fd.number(s.number().pipe(min(1), max(5))),
      action: fd.text(s.optional(s.string())),
    })
    let submission = { values, errors: { fields: {} } }
    function markup(state: fd.FormSubmission) {
      return (
        <form.Context id="native-types" schema={schema} submission={state}>
          {({ fields }) => (
            <form mix={form.root()}>
              <input type="date" min="2026-01-01" mix={form.control(fields.date)} />
              <input type="month" mix={form.control(fields.month)} />
              <input type="week" mix={form.control(fields.week)} />
              <input type="time" mix={form.control(fields.time)} />
              <input type="datetime-local" mix={form.control(fields['datetime-local'])} />
              <input type="color" mix={form.control(fields.color)} />
              <input type="hidden" mix={form.control(fields.hidden)} />
              <input type="range" mix={form.control(fields.range)} />
              <input type="submit" value="save" mix={form.control(fields.action)} />
              <input type="button" value="Help" />
              <input type="reset" value="Reset" />
              <input type="image" alt="Save" />
            </form>
          )}
        </form.Context>
      )
    }
    let container = document.createElement('div')
    container.innerHTML = await renderToString(markup(submission))
    document.body.appendChild(container)
    for (let [name, value] of Object.entries(values))
      expect(input(container, name).value).toBe(value)
    let view = render(markup(submission), { container })
    t.after(view.cleanup)
    let native = container.querySelector('form')
    if (!native) throw new Error('Missing form')
    let range = input(container, 'range')
    expect(range.min).toBe('1')
    expect(range.max).toBe('5')
    expect(range.step).toBe('any')
    expect(range.required).toBe(false)
    expect(input(container, 'color').hasAttribute('minlength')).toBe(false)
    expect(input(container, 'hidden').required).toBe(false)
    expect(input(container, 'action').value).toBe('save')
    expect(input(container, 'action').hasAttribute('data-form-input')).toBe(false)
    edit(range, '3')
    view.root.render(markup(submission))
    view.root.flush()
    expect(range.value).toBe('3')
    edit(input(container, 'date'), '2025-12-31')
    expect(native.checkValidity()).toBe(false)
    edit(input(container, 'date'), values.date)
    expect(native.checkValidity()).toBe(true)
    view.root.render(markup({ values: { ...values, range: '2' }, errors: { fields: {} } }))
    view.root.flush()
    expect(range.value).toBe('2')
    edit(range, '5')
    native.reset()
    await Promise.resolve()
    expect(range.value).toBe('2')
    let result = fd.parseSafe(schema, new FormData(native))
    expect(result.success).toBe(false)
    if (result.success) throw new Error('Expected server rejection of hidden field')
    expect(Object.keys(result.errors.fields)).toEqual(['hidden'])
    expect(result.values.range).toBe('2')
  })

  it('shares radio feedback, validates selected values, and restores group defaults', async (t) => {
    let schema = fd.object({
      delivery: fd.text(
        s.enum_(['email', 'sms']).refine((value) => value === 'email', 'Email only'),
        { name: 'delivery.method' },
      ),
    })
    let submission = fd.parseSafe(schema, new URLSearchParams({ 'delivery.method': 'sms' }))
    if (submission.success) throw new Error('Expected failed submission')
    let showSms = true
    let binding: FieldBinding<'text'> | undefined
    function markup(state?: fd.FormSubmission) {
      return (
        <form.Context id="radio-form" schema={schema} submission={state}>
          {({ fields }) => {
            binding = fields.delivery
            return (
              <form mix={form.root()}>
                <fieldset>
                  <legend>Delivery</legend>
                  <input type="radio" value="email" mix={form.control(fields.delivery)} />
                  <label mix={form.label(fields.delivery, 'email')}>Email</label>
                  {showSms && (
                    <>
                      <input type="radio" value="sms" mix={form.control(fields.delivery)} />
                      <label mix={form.label(fields.delivery, 'sms')}>SMS</label>
                    </>
                  )}
                  <p mix={form.error(fields.delivery)}>{fields.delivery.errors.join(' ')}</p>
                </fieldset>
              </form>
            )
          }}
        </form.Context>
      )
    }
    let container = document.createElement('div')
    container.innerHTML = await renderToString(markup(submission))
    document.body.appendChild(container)
    let email = container.querySelector('input[value="email"]')
    let sms = container.querySelector('input[value="sms"]')
    let native = container.querySelector('form')
    if (!(email instanceof HTMLInputElement) || !(sms instanceof HTMLInputElement) || !native)
      throw new Error('Missing group')
    expect(email.checked).toBe(false)
    expect(sms.checked).toBe(true)
    expect(email.value).toBe('email')
    expect(email.id === sms.id).toBe(false)
    expect([...container.querySelectorAll('label')].map((label) => label.control)).toEqual([
      email,
      sms,
    ])
    let view = render(markup(submission), { container })
    t.after(view.cleanup)
    expect(native.checkValidity()).toBe(false)
    email.click()
    view.root.flush()
    expect(native.checkValidity()).toBe(true)
    expect(container.querySelector('p')?.textContent).toBe('')
    expect(sms.getAttribute('aria-invalid')).toBe(null)
    expect(fd.parseSafe(schema, new FormData(native))).toEqual({
      success: true,
      value: { delivery: 'email' },
    })
    if (!binding) throw new Error('Missing binding')
    binding.setCustomErrors(['Try again'])
    expect(native.checkValidity()).toBe(false)
    view.root.render(markup(submission))
    view.root.flush()
    expect(email.checked).toBe(true)
    expect(native.checkValidity()).toBe(false)
    sms.click()
    view.root.flush()
    expect(binding.errors).toEqual(['Email only'])
    email.click()
    view.root.flush()
    expect(native.checkValidity()).toBe(true)
    view.root.render(markup({ ...submission }))
    view.root.flush()
    expect(sms.checked).toBe(true)
    email.click()
    native.reset()
    await Promise.resolve()
    view.root.flush()
    expect(sms.checked).toBe(true)
    email.click()
    showSms = false
    view.root.render(markup(submission))
    view.root.flush()
    email.checked = false
    expect(native.checkValidity()).toBe(false)
    email.click()
    view.root.flush()
    expect(native.checkValidity()).toBe(true)
    binding.setCustomErrors(['Still registered'])
    expect(native.checkValidity()).toBe(false)
    binding.setCustomErrors([])
    expect(native.checkValidity()).toBe(true)
  })

  it('validates single and multiple files and clears selections on new failures', async (t) => {
    let schema = fd.object({
      avatar: fd.file(
        s
          .optional(s.instanceof_(Blob))
          .refine((file) => !file || file.size <= 3, 'Small files only'),
      ),
      attachments: fd.files(
        s.array(s.instanceof_(Blob)).refine((files) => files.length > 0, 'Choose files'),
      ),
    })
    let view = renderForm(schema, ({ fields }) => (
      <form encType="multipart/form-data" mix={form.root()}>
        <label mix={form.label(fields.avatar)}>Avatar</label>
        <input accept="text/plain" mix={form.control(fields.avatar)} />
        <input mix={form.control(fields.attachments)} />
        <p mix={form.error(fields.avatar)}>{fields.avatar.errors.join(' ')}</p>
      </form>
    ))
    t.after(view.cleanup)
    let avatar = input(view.container, 'avatar')
    let attachments = input(view.container, 'attachments')
    let native = view.container.querySelector('form')
    if (!native) throw new Error('Missing form')
    expect(avatar.type).toBe('file')
    expect(avatar.multiple).toBe(false)
    expect(attachments.multiple).toBe(true)
    expect(attachments.required).toBe(true)
    expect(native.checkValidity()).toBe(false)
    let transfer = new DataTransfer()
    transfer.items.add(new File(['large'], 'test.txt'))
    avatar.files = transfer.files
    attachments.files = transfer.files
    avatar.dispatchEvent(new Event('input', { bubbles: true }))
    attachments.dispatchEvent(new Event('input', { bubbles: true }))
    blur(avatar)
    view.root.flush()
    expect(view.fields.avatar.errors).toEqual(['Small files only'])
    let failure = fd.parseSafe(schema, new FormData(native))
    if (failure.success) throw new Error('Expected failure')
    expect(failure.values).toEqual({})
    expect(failure.errors.fields.avatar).toEqual(['Small files only'])
    view.rerender(failure)
    expect(avatar.files?.length).toBe(0)
    expect(attachments.files?.length).toBe(0)
    transfer = new DataTransfer()
    transfer.items.add(new File(['ok'], 'first.txt'))
    transfer.items.add(new File([], 'empty.txt'))
    avatar.files = transfer.files
    attachments.files = transfer.files
    avatar.dispatchEvent(new Event('input', { bubbles: true }))
    attachments.dispatchEvent(new Event('input', { bubbles: true }))
    view.root.flush()
    expect(native.checkValidity()).toBe(true)
    let result = fd.parseSafe(schema, new FormData(native))
    expect(result.success).toBe(true)
    if (!result.success) throw new Error('Expected success')
    expect(result.value.avatar?.size).toBe(2)
    expect(result.value.attachments.length).toBe(2)
    native.reset()
    await Promise.resolve()
    view.root.flush()
    expect(avatar.files?.length).toBe(0)
    expect(view.fields.avatar.touched).toBe(false)
  })

  it('omits form errors when none exist and renders submitted form errors', (t) => {
    let schema = fd.object({ name: fd.text(s.string()) })
    let view = renderForm(schema, ({ fields, errors }) => (
      <form mix={form.root()}>
        {errors.form && <p role="alert">{errors.form.join(' ')}</p>}
        <input mix={form.control(fields.name)} />
      </form>
    ))
    t.after(view.cleanup)
    expect(view.container.querySelector('p')).toBe(null)
    view.rerender({ values: {}, errors: { fields: {}, form: ['Try again'] } })
    expect(view.container.querySelector('p')?.textContent).toBe('Try again')
    view.rerender({ values: {}, errors: { fields: {}, form: [] } })
    expect(view.container.querySelector('p')).toBe(null)
  })

  it('rerenders a child field component with a stable binding through props', (t) => {
    let schema = fd.object({
      username: fd.text(s.string().refine((value) => value.startsWith('@'), 'Start with @')),
    })
    let renders = 0
    function Username(handle: Handle<{ field: FieldBinding<'text'> }>) {
      return () => {
        renders++
        let field = handle.props.field
        return (
          <>
            <label mix={form.label(field)}>Username</label>
            <input mix={form.control(field)} />
            {field.errors.length > 0 && (
              <p role="alert" mix={form.error(field)}>
                {field.errors.join(' ')}
              </p>
            )}
          </>
        )
      }
    }
    let view = renderForm(schema, ({ fields }) => (
      <form mix={form.root()}>
        <Username field={fields.username} />
      </form>
    ))
    t.after(view.cleanup)
    let field = view.fields.username
    let node = input(view.container)
    expect(view.container.querySelector('label')?.control).toBe(node)
    edit(node, 'ada')
    view.root.flush()
    expect(view.container.querySelector('p')).toBe(null)
    expect(field.touched).toBe(false)
    blur(node)
    view.root.flush()
    expect(view.fields.username).toBe(field)
    expect(renders).toBe(2)
    expect(view.container.querySelector('p')?.textContent).toBe('Start with @')
    expect(node.getAttribute('aria-describedby')).toBe(field.errorId)
    edit(node, '@ada')
    view.root.flush()
    expect(view.container.querySelector('p')).toBe(null)
    expect(node.hasAttribute('aria-describedby')).toBe(false)
    expect(node.value).toBe('@ada')
    edit(node, '')
    expect(view.container.querySelector('form')?.checkValidity()).toBe(false)
    view.root.flush()
    expect(view.container.querySelector('p')?.textContent).toBe(node.validationMessage)
  })

  it('renders server errors before controls, derives kinds, and scopes accessible IDs', async (t) => {
    let schema = fd.object({
      email: fd.text(s.string().pipe(email())),
      password: fd.password(s.string().pipe(minLength(8))),
      securityCode: fd.text(s.string(), { sensitive: true }),
      terms: fd.checkbox(s.literal(true)),
    })
    let submission = {
      values: { email: 'bad', password: 'must-not-restore', securityCode: 'private-code' },
      errors: { fields: { email: ['Use another address'] }, form: [] },
    }
    let markup = (
      <>
        <form.Context id="signup" schema={schema} submission={submission}>
          {({ fields }) => (
            <>
              <p role="alert" mix={form.error(fields.email)}>
                {fields.email.errors.join(' ')}
              </p>
              <label mix={form.label(fields.email)}>Email</label>
              <input type="email" mix={form.control(fields.email)} />
              <input mix={form.control(fields.password)} />
              <input mix={form.control(fields.securityCode)} />
              <input mix={form.control(fields.terms)} />
            </>
          )}
        </form.Context>
        <form.Context id="profile" schema={schema}>
          {({ fields }) => <input mix={form.control(fields.email)} />}
        </form.Context>
      </>
    )
    let html = await renderToString(markup)
    expect(html).toContain('Use another address')
    expect(html).toContain('value="bad"')
    expect(html).not.toContain('must-not-restore')
    expect(html).not.toContain('private-code')
    expect(html).toContain('type="password"')
    expect(html).toContain('type="checkbox"')
    let container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)
    let serverNodes = [...container.querySelectorAll('input')]
    let serverIds = serverNodes.map((node) => node.id)
    let view = render(markup, { container })
    t.after(view.cleanup)
    let nodes = view.container.querySelectorAll('input')
    expect([...nodes].map((node) => node.id)).toEqual(serverIds)
    expect(nodes[0]).toBe(serverNodes[0])
    expect(new Set([...nodes].map((node) => node.id)).size).toBe(5)
    expect(view.container.querySelector('label')?.control).toBe(nodes[0])
    expect(nodes[0].getAttribute('aria-describedby')).toBe(view.container.querySelector('p')?.id)
    expect(nodes[0].getAttribute('aria-invalid')).toBe('true')
    expect(nodes[1].value).toBe('')
    expect(nodes[2].required).toBe(true)
  })

  it('preserves host props and help text while clearing stale server feedback after editing', (t) => {
    let schema = fd.object({ email: fd.text(s.string().pipe(email())) })
    let submission = {
      values: { email: 'old@example.com' },
      errors: { fields: { email: ['Server message'] }, form: [] },
    }
    let view = renderForm(
      schema,
      ({ fields }) => (
        <>
          <label htmlFor="authored" title="Custom label" mix={form.label(fields.email)}>
            Email
          </label>
          <input
            id="authored"
            type="email"
            defaultValue="authored@example.com"
            aria-describedby="help"
            mix={form.control(fields.email)}
          />
          <p id="help">Help</p>
          <p mix={form.error(fields.email)}>{fields.email.errors.join(' ')}</p>
        </>
      ),
      submission,
    )
    t.after(view.cleanup)
    let node = input(view.container)
    expect(node.value).toBe('authored@example.com')
    expect(view.container.querySelector('label')?.control).toBe(node)
    expect(node.getAttribute('aria-describedby')).toBe(`help ${view.fields.email.errorId}`)
    expect(view.fields.email.touched).toBe(false)
    edit(node, 'valid@example.com')
    view.root.flush()
    expect(view.fields.email.errors).toEqual([])
    expect(view.fields.email.touched).toBe(true)
    expect(node.getAttribute('aria-describedby')).toBe('help')
    expect(node.hasAttribute('data-form-error-id')).toBe(false)
  })

  it('restores a new submission without replaying values during ordinary rerenders', (t) => {
    let schema = fd.object({
      name: fd.text(s.string()),
      password: fd.password(s.string()),
      securityCode: fd.text(s.string(), { sensitive: true }),
    })
    let first = {
      values: { name: 'first' },
      errors: { fields: { name: ['First error'] }, form: [] },
    }
    let view = renderForm(
      schema,
      ({ fields }) => (
        <>
          <input mix={form.control(fields.name)} />
          <input mix={form.control(fields.password)} />
          <input mix={form.control(fields.securityCode)} />
        </>
      ),
      first,
    )
    t.after(view.cleanup)
    let name = input(view.container, 'name')
    let password = input(view.container, 'password')
    let securityCode = input(view.container, 'securityCode')
    edit(name, 'edited')
    edit(password, 'secret')
    edit(securityCode, 'private-code')
    view.rerender(first)
    expect(name.value).toBe('edited')
    expect(password.value).toBe('secret')
    expect(securityCode.value).toBe('private-code')
    let field = view.fields.name
    view.rerender({
      values: { name: 'second' },
      errors: { fields: { name: ['Second error'] }, form: [] },
    })
    expect(view.fields.name).toBe(field)
    expect(name.value).toBe('second')
    expect(password.value).toBe('')
    expect(securityCode.value).toBe('')
    expect(field.touched).toBe(false)
    expect(field.errors).toEqual(['Second error'])
  })

  it('restores select defaults through SSR, hydration, and replacement submissions', async (t) => {
    let schema = fd.object({
      name: fd.text(s.string().pipe(minLength(2))),
      role: fd.text(s.enum_(['customer', 'admin'])),
      secret: fd.text(s.string(), { sensitive: true }),
    })
    let first = fd.parseSafe(
      schema,
      new URLSearchParams({ name: 'A', role: 'admin', secret: 'private' }),
    )
    if (first.success) throw new Error('Expected failure')
    function markup(submission: fd.FormSubmission) {
      return (
        <form.Context id="select-restoration" schema={schema} submission={submission}>
          {({ fields }) => (
            <form mix={form.root()}>
              <select mix={form.control(fields.role)}>
                <option value="customer">Customer</option>
                <optgroup label="Staff">
                  <option value="admin">Admin</option>
                </optgroup>
              </select>
              <select mix={form.control(fields.secret)}>
                <option value="">Choose</option>
                <option value="private">Private</option>
              </select>
            </form>
          )}
        </form.Context>
      )
    }
    let container = document.createElement('div')
    container.innerHTML = await renderToString(markup(first))
    document.body.appendChild(container)
    let role = container.querySelector('select[name="role"]')
    let secret = container.querySelector('select[name="secret"]')
    let native = container.querySelector('form')
    if (!(role instanceof HTMLSelectElement) || !(secret instanceof HTMLSelectElement) || !native)
      throw new Error('Missing form controls')
    expect(role.value).toBe('admin')
    expect(role.options[1].defaultSelected).toBe(true)
    expect(secret.value).toBe('')
    let view = render(markup(first), { container })
    t.after(view.cleanup)
    expect(container.querySelector('select[name="role"]')).toBe(role)
    expect(role.value).toBe('admin')
    edit(role, 'customer')
    edit(secret, 'private')
    view.root.render(markup(first))
    view.root.flush()
    expect(role.value).toBe('customer')
    expect(secret.value).toBe('private')
    edit(role, 'admin')
    view.root.render(markup({ values: { role: 'customer' }, errors: { fields: {} } }))
    view.root.flush()
    expect(role.value).toBe('customer')
    expect(secret.value).toBe('')
    edit(role, 'admin')
    native.reset()
    await Promise.resolve()
    view.root.flush()
    expect(role.value).toBe('customer')
  })

  it('supports select and textarea validity, canceled reset, and native reset timing', async (t) => {
    let schema = fd.object({
      choice: fd.text(s.string()),
      bio: fd.text(s.string()),
      terms: fd.checkbox(s.literal(true)),
    })
    let view = renderForm(schema, ({ fields }) => (
      <form mix={form.root()}>
        <select mix={form.control(fields.choice)}>
          <option value="">Choose</option>
          <option value="ada">Ada</option>
        </select>
        <textarea defaultValue="original" mix={form.control(fields.bio)} />
        <input mix={form.control(fields.terms)} />
      </form>
    ))
    t.after(view.cleanup)
    let native = view.container.querySelector('form')
    let choice = view.container.querySelector('select')
    let bio = view.container.querySelector('textarea')
    if (!native || !choice || !bio) throw new Error('Missing form')
    expect(native.checkValidity()).toBe(false)
    expect(view.fields.choice.touched).toBe(true)
    expect(view.fields.terms.touched).toBe(true)
    edit(choice, 'ada')
    edit(bio, 'edited')
    blur(bio)
    let cancel = (event: Event) => event.preventDefault()
    native.addEventListener('reset', cancel)
    native.reset()
    await Promise.resolve()
    expect(bio.value).toBe('edited')
    expect(view.fields.bio.touched).toBe(true)
    native.removeEventListener('reset', cancel)
    native.reset()
    await Promise.resolve()
    view.root.flush()
    expect(bio.value).toBe('original')
    expect(view.fields.bio.touched).toBe(false)
    expect(view.fields.choice.errors).toEqual([])
    expect(view.fields.terms.errors).toEqual([])
  })

  it('enhances unmanaged native controls through the root mixin', (t) => {
    let view = renderForm(fd.object({}), () => (
      <form mix={form.root()}>
        <input required />
      </form>
    ))
    t.after(view.cleanup)
    let node = input(view.container)
    expect(node.hasAttribute('aria-invalid')).toBe(false)
    blur(node)
    expect(node.getAttribute('aria-invalid')).toBe('true')
    edit(node, 'valid')
    expect(node.hasAttribute('aria-invalid')).toBe(false)
  })
})
