import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import * as s from '@remix-run/data-schema'
import * as fd from '@remix-run/data-schema/experimental/form'
import { email, min } from '@remix-run/data-schema/checks'
import * as form from './form.ts'
import { renderForm, input, edit, blur } from './test/form.tsx'

describe('field errorMap', () => {
  it('maps native messages immediately and reveals the same inline message after blur', (t) => {
    let contexts: s.ErrorMapContext[] = []
    let schema = fd.object({
      email: fd.text(s.string().pipe(email()), {
        name: 'account.email',
        errorMap(context) {
          contexts.push(context)
          if (context.code === 'value.required') return 'Enter your email'
          if (context.code === 'string.email') return 'Use a valid email address'
        },
      }),
    })
    let view = renderForm(schema, ({ fields }) => (
      <input type="email" mix={form.control(fields.email)} />
    ))
    t.after(view.cleanup)
    let node = input(view.container)
    let field = view.fields.email
    expect(node.validationMessage).toBe('Enter your email')
    expect(field.errors).toEqual([])
    expect(field.touched).toBe(false)
    edit(node, 'invalid')
    expect(node.validity.typeMismatch).toBe(true)
    expect(node.validationMessage).toBe('Use a valid email address')
    expect(field.errors).toEqual([])
    blur(node)
    expect(field.errors).toEqual(['Use a valid email address'])
    expect(node.getAttribute('aria-describedby')).toBe(field.errorId)
    expect(contexts.at(-1)?.path).toEqual(['email'])
    expect(contexts.at(-1)?.input).toBe('invalid')
    edit(node, 'ada@example.com')
    expect(node.validity.valid).toBe(true)
    expect(node.validationMessage).toBe('')
    expect(field.errors).toEqual([])
  })

  it('composes mapped native and refinement errors with untouched supplemental errors', (t) => {
    let schema = fd.object({
      age: fd.number(
        s
          .number()
          .pipe(min(13))
          .refine((value) => value !== 42),
        {
          errorMap({ code, input, values, defaultMessage }) {
            if (code === 'number.min') {
              expect(input).toBe(12)
              expect(values).toEqual({ min: 13 })
              return 'You must be at least 13'
            }
            if (code === 'refine.failed') {
              expect(defaultMessage).toBe('Refinement failed')
              return 'Choose another age'
            }
          },
        },
      ),
    })
    let view = renderForm(schema, ({ fields }) => (
      <form mix={form.root()}>
        <input mix={form.control(fields.age)} />
      </form>
    ))
    t.after(view.cleanup)
    let node = input(view.container)
    let field = view.fields.age
    edit(node, '12')
    field.setCustomErrors(['Application error'])
    expect(node.validationMessage).toBe('You must be at least 13')
    expect(view.container.querySelector('form')?.checkValidity()).toBe(false)
    expect(field.errors).toEqual(['You must be at least 13', 'Application error'])
    edit(node, '42')
    expect(field.errors).toEqual(['Choose another age'])
    field.setCustomErrors(['Application error'])
    expect(field.errors).toEqual(['Choose another age', 'Application error'])
    edit(node, '37')
    expect(node.validity.valid).toBe(true)
    expect(field.errors).toEqual([])
    node.step = '2'
    edit(node, '36')
    expect(node.validity.stepMismatch).toBe(true)
    expect(node.validity.customError).toBe(false)
    expect(field.errors).toEqual([node.validationMessage])
  })
})
