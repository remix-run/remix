import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { renderToString } from '@remix-run/component/server'
import { render } from '@remix-run/component/test'
import type { Handle } from '@remix-run/component'
import * as s from '@remix-run/data-schema'
import * as fd from '@remix-run/data-schema/experimental/form'
import { email, minLength, min, max } from '@remix-run/data-schema/checks'
import * as form from './form.ts'
import type { FieldBinding } from './form.ts'
import { renderForm, renderServerForm, input, edit, blur } from './test/form.tsx'
import { mouseClick } from './test/pointer.ts'

describe('form.Context', () => {
  it('validates transformed outputs without projecting their bounds onto raw inputs', (t) => {
    let schema = fd.object({
      count: fd.number(
        s
          .number()
          .pipe(min(1))
          .transform((value) => value * 2)
          .pipe(min(10), max(20)),
      ),
    })
    let view = renderForm(schema, ({ fields }) => (
      <form mix={form.root()}>
        <input defaultValue="6" mix={form.control(fields.count)} />
      </form>
    ))
    t.after(view.cleanup)
    let node = input(view.container)
    let native = view.container.querySelector('form')
    if (!native) throw new Error('Missing form')
    expect(node.min).toBe('1')
    expect(node.max).toBe('')
    expect(native.checkValidity()).toBe(true)
    expect(fd.parseSafe(schema, new FormData(native))).toEqual({
      success: true,
      value: { count: 12 },
    })
    edit(node, '3')
    expect(native.checkValidity()).toBe(false)
    edit(node, '12')
    expect(native.checkValidity()).toBe(false)
  })

  it('keeps label text unselectable with a default cursor and leaves its input selectable', (t) => {
    let schema = fd.object({ name: fd.text(s.string()) })
    let view = renderForm(schema, ({ fields }) => (
      <form mix={form.root()}>
        <label mix={form.label(fields.name)}>Name</label>
        <input mix={form.control(fields.name)} />
      </form>
    ))
    t.after(view.cleanup)
    let label = getComputedStyle(view.container.querySelector('label') as HTMLElement)
    expect(label.cursor).toBe('default')
    expect(label.userSelect).toBe('none')
    expect(getComputedStyle(input(view.container)).userSelect).not.toBe('none')
  })

  it('toggles the control of a form.label() on mouse press, once', (t) => {
    let schema = fd.object({ agree: fd.checkbox() })
    let view = renderForm(schema, ({ fields }) => (
      <form mix={form.root()}>
        <label mix={form.label(fields.agree)}>Agree</label>
        <input type="checkbox" mix={form.control(fields.agree)} />
      </form>
    ))
    t.after(view.cleanup)
    let label = view.container.querySelector('label') as HTMLElement
    let checkbox = input(view.container)

    mouseClick(label)
    expect(checkbox.checked).toBe(true)

    mouseClick(label)
    expect(checkbox.checked).toBe(false)
  })

  it('revalidates a selected radio when its JSX value changes before submission', (t) => {
    let value = 'sms'
    let schema = fd.object({
      delivery: fd.text(s.string().refine((value) => value === 'email', 'Email only')),
    })
    let view = renderForm(schema, ({ fields }) => (
      <form mix={form.root()}>
        <fieldset>
          <legend>Delivery</legend>
          <input type="radio" value={value} defaultChecked mix={form.control(fields.delivery)} />
          <label mix={form.label(fields.delivery, value)}>Delivery option</label>
        </fieldset>
      </form>
    ))
    t.after(view.cleanup)
    let native = view.container.querySelector('form')
    if (!native) throw new Error('Missing form')
    expect(native.checkValidity()).toBe(false)
    value = 'email'
    view.rerender()
    let node = input(view.container)
    expect(node.validationMessage).toBe('')
    expect(view.fields.delivery.errors).toEqual([])
    expect(view.container.querySelector('label')?.control).toBe(node)
    let submissions = 0
    native.addEventListener('submit', (event) => {
      event.preventDefault()
      submissions++
    })
    native.requestSubmit()
    expect(submissions).toBe(1)
    expect(fd.parseSafe(schema, new FormData(native))).toEqual({
      success: true,
      value: { delivery: 'email' },
    })
  })

  it('validates and restores multiple select values through SSR, hydration, and reset', async (t) => {
    let schema = fd.object({
      topics: fd.fields(s.array(s.string()).refine((values) => values.length >= 2, 'Choose two')),
    })
    let failure = fd.parseSafe(schema, new URLSearchParams({ topics: 'a' }))
    if (failure.success) throw new Error('Expected failure')
    let server = await renderServerForm(
      schema,
      ({ fields }) => (
        <form mix={form.root()}>
          <label mix={form.label(fields.topics)}>Topics</label>
          <select mix={form.control(fields.topics)}>
            <option value="a">A</option>
            <optgroup label="More">
              <option value="b">B</option>
              <option value="c">C</option>
            </optgroup>
            <optgroup label="Unavailable" disabled>
              <option value="disabled">Disabled</option>
            </optgroup>
          </select>
          <p role="alert" mix={form.error(fields.topics)}>
            {fields.topics.errors.join(' ')}
          </p>
        </form>
      ),
      failure,
    )
    let container = server.container
    let select = container.querySelector('select')
    let native = container.querySelector('form')
    if (!select || !native) throw new Error('Missing controls')
    expect(select.multiple).toBe(true)
    expect([...select.selectedOptions].map((option) => option.value)).toEqual(['a'])
    expect(container.querySelector('label')?.control).toBe(select)
    let view = server.hydrate()
    t.after(view.cleanup)
    expect(native.checkValidity()).toBe(false)
    select.options[1].selected = true
    select.options[3].selected = true
    select.dispatchEvent(new Event('change', { bubbles: true }))
    view.root.flush()
    expect(native.checkValidity()).toBe(true)
    expect(fd.parseSafe(schema, new FormData(native))).toEqual({
      success: true,
      value: { topics: ['a', 'b'] },
    })
    expect(container.querySelector('p')?.textContent).toBe('')
    view.rerender(failure)
    expect(select.options[1].selected).toBe(true)
    let next = { values: { topics: ['b', 'c'] }, errors: { fields: {} } }
    view.rerender(next)
    expect([...select.selectedOptions].map((option) => option.value)).toEqual(['b', 'c'])
    select.options[0].selected = true
    native.reset()
    await Promise.resolve()
    view.root.flush()
    expect([...select.selectedOptions].map((option) => option.value)).toEqual(['b', 'c'])
    view.rerender({ values: { topics: [] }, errors: { fields: {} } })
    expect(select.selectedOptions.length).toBe(0)
    expect(native.checkValidity()).toBe(false)
    let empty = fd.parseSafe(schema, new FormData(native))
    if (empty.success) throw new Error('Expected empty selection failure')
    expect(empty.values.topics).toEqual([])
  })

  it('coordinates repeated checkbox values, group errors, and restored checked defaults', async (t) => {
    let schema = fd.object({
      topics: fd.fields(
        s.array(s.string()).refine((values) => values.length >= 2, 'Choose two'),
        { name: 'topic[]' },
      ),
    })
    let failure = fd.parseSafe(schema, new URLSearchParams({ 'topic[]': 'a' }))
    if (failure.success) throw new Error('Expected failure')
    let showB = true
    let server = await renderServerForm(
      schema,
      ({ fields }) => (
        <form mix={form.root()}>
          <fieldset>
            <legend>Topics</legend>
            <input value="a" mix={form.control(fields.topics)} />
            <label mix={form.label(fields.topics, 'a')}>A</label>
            {showB && (
              <>
                <input value="b" mix={form.control(fields.topics)} />
                <label mix={form.label(fields.topics, 'b')}>B</label>
              </>
            )}
            <input value="disabled" disabled defaultChecked mix={form.control(fields.topics)} />
            <p role="alert" mix={form.error(fields.topics)}>
              {fields.topics.errors.join(' ')}
            </p>
          </fieldset>
        </form>
      ),
      failure,
    )
    let container = server.container
    let nodes = container.querySelectorAll('input')
    let native = container.querySelector('form')
    if (!native) throw new Error('Missing form')
    expect(nodes[0].type).toBe('checkbox')
    expect(nodes[0].checked).toBe(true)
    expect(nodes[1].checked).toBe(false)
    expect(nodes[0].required).toBe(false)
    expect([...container.querySelectorAll('label')].map((label) => label.control)).toEqual([
      nodes[0],
      nodes[1],
    ])
    expect(fd.parseSafe(schema, new FormData(native))).toEqual(failure)
    let view = server.hydrate()
    t.after(view.cleanup)
    expect(native.checkValidity()).toBe(false)
    nodes[1].click()
    view.root.flush()
    expect(native.checkValidity()).toBe(true)
    expect(fd.parseSafe(schema, new FormData(native))).toEqual({
      success: true,
      value: { topics: ['a', 'b'] },
    })
    let binding = view.fields.topics
    binding.setCustomErrors(['Unavailable combination'])
    expect(native.checkValidity()).toBe(false)
    view.rerender(failure)
    expect(native.checkValidity()).toBe(false)
    nodes[0].click()
    view.root.flush()
    expect(binding.errors).toEqual(['Choose two'])
    nodes[0].click()
    view.root.flush()
    expect(native.checkValidity()).toBe(true)
    view.rerender({ ...failure })
    expect(nodes[0].checked).toBe(true)
    expect(nodes[1].checked).toBe(false)
    nodes[1].click()
    native.reset()
    await Promise.resolve()
    view.root.flush()
    expect(nodes[1].checked).toBe(false)
    expect(binding.touched).toBe(false)
    expect(native.checkValidity()).toBe(false)
    view.rerender({ values: { topics: [] }, errors: { fields: {} } })
    expect(nodes[0].checked).toBe(false)
    expect(nodes[1].checked).toBe(false)
    let both = { values: { topics: ['a', 'b'] }, errors: { fields: {} } }
    view.rerender(both)
    expect(native.checkValidity()).toBe(true)
    showB = false
    view.rerender(both)
    await Promise.resolve()
    view.root.flush()
    expect(native.checkValidity()).toBe(false)
  })

  it('restores native string controls and numeric ranges without projecting unrelated constraints', async (t) => {
    let values = {
      date: '2026-11-04',
      color: '#123456',
      hidden: 'original',
      range: '4',
    }
    let schema = fd.object({
      date: fd.text(s.string()),
      color: fd.text(s.string().pipe(minLength(7))),
      hidden: fd.text(s.string().pipe(minLength(20))),
      range: fd.number(s.number().pipe(min(1), max(5))),
      action: fd.text(s.optional(s.string())),
    })
    let submission = { values, errors: { fields: {} } }
    let server = await renderServerForm(
      schema,
      ({ fields }) => (
        <form mix={form.root()}>
          <input type="date" min="2026-01-01" mix={form.control(fields.date)} />
          <input type="color" mix={form.control(fields.color)} />
          <input type="hidden" mix={form.control(fields.hidden)} />
          <input type="range" mix={form.control(fields.range)} />
          <input type="submit" value="save" mix={form.control(fields.action)} />
        </form>
      ),
      submission,
    )
    let container = server.container
    for (let [name, value] of Object.entries(values))
      expect(input(container, name).value).toBe(value)
    let view = server.hydrate()
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
    edit(input(container, 'date'), '2025-12-31')
    expect(native.checkValidity()).toBe(false)
    edit(input(container, 'date'), values.date)
    expect(native.checkValidity()).toBe(true)
    let result = fd.parseSafe(schema, new FormData(native))
    expect(result.success).toBe(false)
    if (result.success) throw new Error('Expected server rejection of hidden field')
    expect(Object.keys(result.errors.fields)).toEqual(['hidden'])
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
    let server = await renderServerForm(
      schema,
      ({ fields }) => (
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
      ),
      submission,
    )
    let container = server.container
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
    let view = server.hydrate()
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
    let binding = view.fields.delivery
    binding.setCustomErrors(['Try again'])
    expect(native.checkValidity()).toBe(false)
    view.rerender(submission)
    expect(email.checked).toBe(true)
    expect(native.checkValidity()).toBe(false)
    sms.click()
    view.root.flush()
    expect(binding.errors).toEqual(['Email only'])
    email.click()
    view.root.flush()
    expect(native.checkValidity()).toBe(true)
    view.rerender({ ...submission })
    expect(sms.checked).toBe(true)
    email.click()
    native.reset()
    await Promise.resolve()
    view.root.flush()
    expect(sms.checked).toBe(true)
    email.click()
    showSms = false
    view.rerender(submission)
    email.checked = false
    expect(native.checkValidity()).toBe(false)
    email.click()
    view.root.flush()
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

  it('passes live bindings through props and preserves edits until a new submission arrives', (t) => {
    let schema = fd.object({
      name: fd.text(s.string().refine((value) => value.startsWith('@'), 'Start with @')),
      password: fd.password(s.string()),
      securityCode: fd.text(s.string(), { sensitive: true }),
    })
    function Username(handle: Handle<{ field: FieldBinding<'text'> }>) {
      return () => {
        let field = handle.props.field
        return (
          <>
            <label htmlFor="authored" mix={form.label(field)}>
              Username
            </label>
            <input id="authored" aria-describedby="help" mix={form.control(field)} />
            <p id="help">Start with @</p>
            {field.errors.length > 0 && (
              <p role="alert" mix={form.error(field)}>
                {field.errors.join(' ')}
              </p>
            )}
          </>
        )
      }
    }
    let view = renderForm(schema, ({ fields, errors }) => (
      <form mix={form.root()}>
        {errors.form && (
          <p className="form-error" role="alert">
            {errors.form.join(' ')}
          </p>
        )}
        <Username field={fields.name} />
        <input mix={form.control(fields.password)} />
        <input mix={form.control(fields.securityCode)} />
      </form>
    ))
    t.after(view.cleanup)
    let field = view.fields.name
    let name = input(view.container, 'name')
    let password = input(view.container, 'password')
    let securityCode = input(view.container, 'securityCode')
    expect(view.container.querySelector('label')?.control).toBe(name)
    expect(view.container.querySelector('[role="alert"]')).toBe(null)
    edit(name, 'ada')
    view.root.flush()
    expect(field.touched).toBe(false)
    expect(view.container.querySelector('[role="alert"]')).toBe(null)
    blur(name)
    view.root.flush()
    expect(view.fields.name).toBe(field)
    expect(view.container.querySelector('[role="alert"]')?.textContent).toBe('Start with @')
    expect(name.getAttribute('aria-describedby')).toBe(`help ${field.errorId}`)
    edit(name, '@ada')
    view.root.flush()
    expect(view.container.querySelector('[role="alert"]')).toBe(null)
    expect(name.getAttribute('aria-describedby')).toBe('help')
    let first = {
      values: { name: '@first' },
      errors: { fields: { name: ['Taken'] }, form: ['Try again'] },
    }
    view.rerender(first)
    expect(name.value).toBe('@first')
    expect(field.touched).toBe(false)
    expect(field.errors).toEqual(['Taken'])
    expect(view.container.querySelector('.form-error')?.textContent).toBe('Try again')
    edit(name, '@edited')
    edit(password, 'secret')
    edit(securityCode, 'private-code')
    view.rerender(first)
    expect(name.value).toBe('@edited')
    expect(password.value).toBe('secret')
    expect(securityCode.value).toBe('private-code')
    expect(field.errors).toEqual([])
    expect(field.touched).toBe(true)
    view.rerender({
      values: { name: '@second' },
      errors: { fields: { name: ['Second error'] }, form: [] },
    })
    expect(view.fields.name).toBe(field)
    expect(name.value).toBe('@second')
    expect(password.value).toBe('')
    expect(securityCode.value).toBe('')
    expect(field.errors).toEqual(['Second error'])
    expect(view.container.querySelector('.form-error')).toBe(null)
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
    let server = await renderServerForm(
      schema,
      ({ fields }) => (
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
      ),
      first,
    )
    let container = server.container
    let role = container.querySelector('select[name="role"]')
    let secret = container.querySelector('select[name="secret"]')
    let native = container.querySelector('form')
    if (!(role instanceof HTMLSelectElement) || !(secret instanceof HTMLSelectElement) || !native)
      throw new Error('Missing form controls')
    expect(role.value).toBe('admin')
    expect(role.options[1].defaultSelected).toBe(true)
    expect(secret.value).toBe('')
    let view = server.hydrate()
    t.after(view.cleanup)
    expect(container.querySelector('select[name="role"]')).toBe(role)
    expect(role.value).toBe('admin')
    edit(role, 'customer')
    edit(secret, 'private')
    view.rerender(first)
    expect(role.value).toBe('customer')
    expect(secret.value).toBe('private')
    edit(role, 'admin')
    view.rerender({ values: { role: 'customer' }, errors: { fields: {} } })
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
