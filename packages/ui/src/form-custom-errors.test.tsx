import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { on } from '@remix-run/component'
import * as s from '@remix-run/data-schema'
import * as fd from '@remix-run/data-schema/form'
import * as form from './form.ts'
import type { InputValidationEvent } from './form.ts'
import { renderForm, input, edit, blur } from './test/form.tsx'

const username = fd.text(s.string().refine((value) => value !== 'schema-invalid', 'Schema error'))

describe('setCustomErrors', () => {
  it('updates validity synchronously, reveals after blur, and survives same-value revalidation', (t) => {
    let events: InputValidationEvent[] = []
    let view = renderForm(fd.object({ username }), ({ fields }) => (
      <input
        defaultValue="ada"
        mix={[
          form.control(fields.username),
          form.onInputValidation((event) => {
            events.push(event)
          }),
        ]}
      />
    ))
    t.after(view.cleanup)
    let node = input(view.container)
    let field = view.fields.username
    let messages = ['Already registered', 'Choose another username', '']
    field.setCustomErrors(messages)
    messages[0] = 'Mutated'
    expect(node.validationMessage).toBe('Already registered')
    expect(node.validity.customError).toBe(true)
    expect(field.errors).toEqual([])
    expect(field.touched).toBe(false)
    expect(node.hasAttribute('aria-invalid')).toBe(false)
    blur(node)
    edit(node, 'ada')
    expect(field.errors).toEqual(['Already registered', 'Choose another username'])
    expect(node.getAttribute('aria-invalid')).toBe('true')
    expect(node.getAttribute('aria-describedby')).toBe(field.errorId)
    expect(node.checkValidity()).toBe(false)
    expect(events.at(-1)?.errors).toEqual(field.errors)
    field.setCustomErrors([])
    expect(node.validity.valid).toBe(true)
    expect(field.errors).toEqual([])
    expect(node.hasAttribute('aria-invalid')).toBe(false)
    expect(node.hasAttribute('aria-describedby')).toBe(false)
  })

  it('keeps native and schema errors primary while composing supplemental messages', (t) => {
    let view = renderForm(fd.object({ username }), ({ fields }) => (
      <input defaultValue="ada" mix={form.control(fields.username)} />
    ))
    t.after(view.cleanup)
    let node = input(view.container)
    let field = view.fields.username
    field.setCustomErrors(['Business error'])
    node.pattern = 'grace'
    blur(node)
    expect(field.errors).toEqual([node.validationMessage, 'Business error'])
    expect(node.validity.patternMismatch).toBe(true)
    node.removeAttribute('pattern')
    edit(node, 'ada')
    expect(field.errors).toEqual(['Business error'])
    edit(node, 'schema-invalid')
    field.setCustomErrors(['Business error'])
    expect(field.errors).toEqual(['Schema error', 'Business error'])
    expect(node.validationMessage).toBe('Schema error')
    field.setCustomErrors([])
    expect(field.errors).toEqual(['Schema error'])
    edit(node, '')
    let native = node.validationMessage
    field.setCustomErrors(['Business error'])
    expect(field.errors).toEqual([native, 'Business error'])
    expect(node.validity.valueMissing).toBe(true)
  })

  it('clears changed-value messages regardless of application listener order', (t) => {
    let view = renderForm(fd.object({ first: username, second: username }), ({ fields }) => (
      <>
        <input
          defaultValue="ada"
          mix={[
            on('input', () => fields.first.setCustomErrors(['First custom error'])),
            form.control(fields.first),
          ]}
        />
        <input
          defaultValue="ada"
          mix={[
            form.control(fields.second),
            on('input', () => fields.second.setCustomErrors(['Second custom error'])),
          ]}
        />
      </>
    ))
    t.after(view.cleanup)
    let first = input(view.container, 'first')
    let second = input(view.container, 'second')
    edit(first, 'grace')
    edit(second, 'grace')
    expect(first.validationMessage).toBe('First custom error')
    expect(second.validationMessage).toBe('Second custom error')
    first.dispatchEvent(new Event('change', { bubbles: true }))
    second.dispatchEvent(new Event('change', { bubbles: true }))
    expect(first.validationMessage).toBe('First custom error')
    expect(second.validationMessage).toBe('Second custom error')
  })

  it('clears supplemental messages on changed values, reset, and a new submission', async (t) => {
    let view = renderForm(fd.object({ username }), ({ fields }) => (
      <form mix={form.root()}>
        <input defaultValue="ada" mix={form.control(fields.username)} />
      </form>
    ))
    t.after(view.cleanup)
    let node = input(view.container)
    let field = view.fields.username
    field.setCustomErrors(['Taken'])
    blur(node)
    edit(node, 'grace')
    expect(field.errors).toEqual([])
    field.setCustomErrors(['Taken'])
    view.container.querySelector('form')?.reset()
    await Promise.resolve()
    view.root.flush()
    expect(node.value).toBe('ada')
    expect(field.errors).toEqual([])
    expect(field.touched).toBe(false)
    field.setCustomErrors(['Taken'])
    view.rerender({ values: { username: 'server' }, errors: { fields: {}, form: [] } })
    expect(node.value).toBe('ada')
    expect(node.validity.valid).toBe(true)
    expect(field.errors).toEqual([])
  })

  it('retains immediate server errors until editing, and attaches pre-mount messages', (t) => {
    let beforeMount = true
    let submission = {
      values: { username: 'server' },
      errors: { fields: { username: ['Server error'] }, form: [] },
    }
    let view = renderForm(
      fd.object({ username }),
      ({ fields }) => {
        if (beforeMount) {
          beforeMount = false
          fields.username.setCustomErrors(['Already taken'])
        }
        return <input mix={form.control(fields.username)} />
      },
      submission,
    )
    t.after(view.cleanup)
    let node = input(view.container)
    let field = view.fields.username
    expect(node.validationMessage).toBe('Already taken')
    expect(field.errors).toEqual(['Server error'])
    expect(field.touched).toBe(false)
    edit(node, 'server')
    expect(field.errors).toEqual(['Already taken'])
    expect(field.touched).toBe(true)
    edit(node, 'other')
    expect(field.errors).toEqual([])
    expect(node.validity.valid).toBe(true)
  })

  it('isolates checkbox errors between instances and retains them after a canceled reset', async (t) => {
    let schema = fd.object({ terms: fd.checkbox() })
    let first = renderForm(schema, ({ fields }) => (
      <form mix={form.root()}>
        <input mix={form.control(fields.terms)} />
      </form>
    ))
    let second = renderForm(schema, ({ fields }) => <input mix={form.control(fields.terms)} />)
    t.after(first.cleanup)
    t.after(second.cleanup)
    let node = input(first.container)
    let field = first.fields.terms
    field.setCustomErrors(['Try again'])
    blur(node)
    expect(field.errors).toEqual(['Try again'])
    expect(second.fields.terms.errors).toEqual([])
    expect(input(second.container).validity.valid).toBe(true)
    first.container
      .querySelector('form')
      ?.addEventListener('reset', (event) => event.preventDefault())
    first.container.querySelector('form')?.reset()
    await Promise.resolve()
    expect(field.errors).toEqual(['Try again'])
    expect(node.validationMessage).toBe('Try again')
    node.checked = true
    node.dispatchEvent(new Event('change', { bubbles: true }))
    expect(field.errors).toEqual([])
    expect(node.validity.valid).toBe(true)
  })

  it('blocks native submission without transient valid feedback notifications', (t) => {
    let snapshots: boolean[] = []
    let view = renderForm(fd.object({ username }), ({ fields }) => (
      <form mix={form.root()}>
        <input
          defaultValue="ada"
          mix={[
            form.control(fields.username),
            form.onInputValidation((event) => {
              snapshots.push(event.currentTarget.validity.valid)
            }),
          ]}
        />
        <button>Save</button>
      </form>
    ))
    t.after(view.cleanup)
    let native = view.container.querySelector('form')
    if (!native) throw new Error('Missing form')
    let submissions = 0
    native.addEventListener('submit', (event) => {
      event.preventDefault()
      submissions++
    })
    view.fields.username.setCustomErrors(['Taken'])
    native.requestSubmit()
    expect(submissions).toBe(0)
    expect(view.fields.username.touched).toBe(true)
    expect(view.fields.username.errors).toEqual(['Taken'])
    expect(snapshots).toEqual([false, false])
    view.fields.username.setCustomErrors([])
    native.requestSubmit()
    expect(submissions).toBe(1)
  })

  it('restores custom validity if a schema validator throws', (t) => {
    let shouldThrow = false
    let schema = fd.object({
      username: fd.text(
        s.string().refine(() => {
          if (shouldThrow) throw new Error('Schema failure')
          return true
        }),
      ),
    })
    let view = renderForm(schema, ({ fields }) => (
      <input defaultValue="ada" mix={form.control(fields.username)} />
    ))
    t.after(view.cleanup)
    let node = input(view.container)
    let field = view.fields.username
    field.setCustomErrors(['Taken'])
    shouldThrow = true
    expect(() => field.setCustomErrors(['Still taken'])).toThrow('Schema failure')
    expect(node.validity.valid).toBe(false)
    expect(node.validationMessage).toBe('Taken')
    shouldThrow = false
    blur(node)
    expect(field.errors).toEqual(['Still taken'])
  })

  it('does not mutate removed controls and scopes messages to remounted values', (t) => {
    let shown = true
    let value = 'ada'
    let view = renderForm(
      fd.object({ username }),
      ({ fields }) => shown && <input defaultValue={value} mix={form.control(fields.username)} />,
    )
    t.after(view.cleanup)
    let original = input(view.container)
    let field = view.fields.username
    field.setCustomErrors(['Taken'])
    shown = false
    view.rerender()
    field.setCustomErrors(['Updated while removed'])
    expect(original.validationMessage).toBe('Taken')
    shown = true
    value = 'grace'
    view.rerender()
    expect(input(view.container).validationMessage).toBe('Updated while removed')
    shown = false
    view.rerender()
    shown = true
    value = 'lin'
    view.rerender()
    expect(input(view.container).validity.valid).toBe(true)
  })

  it('scopes supplemental messages to select and textarea values', (t) => {
    let schema = fd.object({ choice: fd.text(s.string()), bio: fd.text(s.string()) })
    let view = renderForm(schema, ({ fields }) => (
      <>
        <select mix={form.control(fields.choice)}>
          <option value="a">A</option>
          <option value="b">B</option>
        </select>
        <textarea defaultValue="hello" mix={form.control(fields.bio)} />
      </>
    ))
    t.after(view.cleanup)
    let choice = view.container.querySelector('select')
    let bio = view.container.querySelector('textarea')
    if (!choice || !bio) throw new Error('Missing controls')
    view.fields.choice.setCustomErrors(['Choice error'])
    view.fields.bio.setCustomErrors(['Bio error'])
    blur(choice)
    blur(bio)
    choice.dispatchEvent(new Event('change', { bubbles: true }))
    bio.dispatchEvent(new Event('input', { bubbles: true }))
    expect(view.fields.choice.errors).toEqual(['Choice error'])
    expect(view.fields.bio.errors).toEqual(['Bio error'])
    edit(choice, 'b')
    edit(bio, 'changed')
    expect(view.fields.choice.errors).toEqual([])
    expect(view.fields.bio.errors).toEqual([])
  })

  it('composes application-owned async checks with event signals and reset/submission guards', async (t) => {
    let submission = { values: {}, errors: { fields: {}, form: [] } }
    let resetVersion = 0
    let requests: Array<{
      signal: AbortSignal
      result: ReturnType<typeof Promise.withResolvers<boolean>>
    }> = []
    let view = renderForm(
      fd.object({ username }),
      ({ fields }) => (
        <form
          mix={[
            form.root(),
            on('reset', () => {
              resetVersion++
            }),
          ]}
        >
          <input
            defaultValue="ada"
            mix={[
              form.control(fields.username),
              on('input', async (event, signal) => {
                let control = event.currentTarget
                let value = control.value
                let currentSubmission = submission
                let version = resetVersion
                let result = Promise.withResolvers<boolean>()
                requests.push({ signal, result })
                let available = await result.promise
                if (
                  signal.aborted ||
                  control.value !== value ||
                  submission !== currentSubmission ||
                  resetVersion !== version
                )
                  return
                fields.username.setCustomErrors(available ? [] : ['Taken'])
              }),
            ]}
          />
        </form>
      ),
      submission,
    )
    t.after(view.cleanup)
    let node = input(view.container)
    blur(node)
    edit(node, 'old')
    edit(node, 'new')
    expect(requests[0].signal.aborted).toBe(true)
    requests[0].result.resolve(false)
    await requests[0].result.promise
    expect(node.validity.valid).toBe(true)
    requests[1].result.resolve(false)
    await requests[1].result.promise
    expect(view.fields.username.errors).toEqual(['Taken'])
    edit(node, 'new')
    requests[2].result.resolve(true)
    await requests[2].result.promise
    expect(view.fields.username.errors).toEqual([])
    edit(node, 'grace')
    view.container.querySelector('form')?.reset()
    requests[3].result.resolve(false)
    await requests[3].result.promise
    expect(node.validity.valid).toBe(true)
    edit(node, 'lin')
    submission = { values: {}, errors: { fields: {}, form: [] } }
    view.rerender(submission)
    requests[4].result.resolve(false)
    await requests[4].result.promise
    expect(view.fields.username.errors).toEqual([])
    expect(node.validity.valid).toBe(true)
  })
})
