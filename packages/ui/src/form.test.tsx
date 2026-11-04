import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { renderToString } from '@remix-run/component/server'
import { render } from '@remix-run/component/test'
import type { Handle } from '@remix-run/component'
import * as s from '@remix-run/data-schema'
import * as fd from '@remix-run/data-schema/form'
import { email, minLength } from '@remix-run/data-schema/checks'
import * as form from './form.ts'
import type { FieldBinding } from './form.ts'
import { renderForm, input, edit, blur } from './test/form.tsx'

describe('form.Context', () => {
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
      terms: fd.checkbox(s.literal(true)),
    })
    let submission = {
      values: { email: 'bad', password: 'must-not-restore' },
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
    expect(new Set([...nodes].map((node) => node.id)).size).toBe(4)
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
    let schema = fd.object({ name: fd.text(s.string()), password: fd.password(s.string()) })
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
        </>
      ),
      first,
    )
    t.after(view.cleanup)
    let name = input(view.container, 'name')
    let password = input(view.container, 'password')
    edit(name, 'edited')
    edit(password, 'secret')
    view.rerender(first)
    expect(name.value).toBe('edited')
    expect(password.value).toBe('secret')
    let field = view.fields.name
    view.rerender({
      values: { name: 'second' },
      errors: { fields: { name: ['Second error'] }, form: [] },
    })
    expect(view.fields.name).toBe(field)
    expect(name.value).toBe('second')
    expect(password.value).toBe('')
    expect(field.touched).toBe(false)
    expect(field.errors).toEqual(['Second error'])
  })

  it('restores select defaults through SSR, hydration, and replacement submissions', async (t) => {
    let schema = fd.object({
      name: fd.text(s.string().pipe(minLength(2))),
      role: fd.text(s.enum_(['customer', 'admin'])),
    })
    let first = fd.parseSafe(schema, new URLSearchParams({ name: 'A', role: 'admin' }))
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
            </form>
          )}
        </form.Context>
      )
    }
    let container = document.createElement('div')
    container.innerHTML = await renderToString(markup(first))
    document.body.appendChild(container)
    let role = container.querySelector('select[name="role"]')
    let native = container.querySelector('form')
    if (!(role instanceof HTMLSelectElement) || !native) throw new Error('Missing form controls')
    expect(role.value).toBe('admin')
    expect(role.options[1].defaultSelected).toBe(true)
    let view = render(markup(first), { container })
    t.after(view.cleanup)
    expect(container.querySelector('select[name="role"]')).toBe(role)
    expect(role.value).toBe('admin')
    edit(role, 'customer')
    view.root.render(markup(first))
    view.root.flush()
    expect(role.value).toBe('customer')
    edit(role, 'admin')
    view.root.render(markup({ values: { role: 'customer' }, errors: { fields: {} } }))
    view.root.flush()
    expect(role.value).toBe('customer')
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
