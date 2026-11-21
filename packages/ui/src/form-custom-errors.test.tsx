import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import * as s from '@remix-run/data-schema'
import * as fd from '@remix-run/data-schema/experimental/form'
import * as form from './form.ts'
import type { InputValidationEvent } from './form.ts'
import { renderForm, input, edit, blur, resetForm } from './test/form.tsx'

const username = fd.text(s.string())

describe('setCustomErrors', () => {
  it('blocks submission and clears supplemental feedback on edits, reset, and new submissions', async (t) => {
    let events: InputValidationEvent[] = []
    let validity: boolean[] = []
    let view = renderForm(fd.object({ username }), ({ fields }) => (
      <form mix={form.root()}>
        <input
          defaultValue="ada"
          mix={[
            form.control(fields.username),
            form.onInputValidation((event) => {
              events.push(event)
              validity.push(event.currentTarget.validity.valid)
            }),
          ]}
        />
        <button>Save</button>
      </form>
    ))
    t.after(view.cleanup)
    let node = input(view.container)
    let native = view.container.querySelector('form')
    if (!native) throw new Error('Missing form')
    let submissions = 0
    native.addEventListener('submit', (event) => {
      event.preventDefault()
      submissions++
    })
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
    native.requestSubmit()
    expect(submissions).toBe(0)
    expect(validity.every((valid) => !valid)).toBe(true)
    expect(events.at(-1)?.errors).toEqual(field.errors)
    field.setCustomErrors([])
    expect(node.validity.valid).toBe(true)
    expect(field.errors).toEqual([])
    expect(node.hasAttribute('aria-invalid')).toBe(false)
    expect(node.hasAttribute('aria-describedby')).toBe(false)
    native.requestSubmit()
    expect(submissions).toBe(1)
    field.setCustomErrors(['Taken'])
    blur(node)
    edit(node, 'grace')
    expect(field.errors).toEqual([])
    field.setCustomErrors(['Taken'])
    await resetForm(native)
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
})
