import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import * as s from '@remix-run/data-schema'
import * as fd from '@remix-run/data-schema/form'
import { email, max, min, url } from '@remix-run/data-schema/checks'
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
  })

  it('preserves explicit refinement messages and leaves unmapped native failures native', (t) => {
    let schema = fd.object({
      username: fd.text(
        s.string().refine((value) => value !== 'admin', 'Reserved username'),
        {
          errorMap() {
            throw new Error('Must bypass mapping')
          },
        },
      ),
    })
    let view = renderForm(schema, ({ fields }) => (
      <input defaultValue="admin" mix={form.control(fields.username)} />
    ))
    t.after(view.cleanup)
    let node = input(view.container)
    expect(node.validationMessage).toBe('Reserved username')
    expect(view.fields.username.errors).toEqual([])
    blur(node)
    expect(view.fields.username.errors).toEqual(['Reserved username'])
    edit(node, 'ada')
    expect(node.validity.valid).toBe(true)
  })

  it('maps numeric bounds and URL failures but leaves step and pattern failures native', (t) => {
    let schema = fd.object({
      amount: fd.number(s.number().pipe(max(10)), {
        errorMap({ code, values }) {
          return code === 'number.max' ? `At most ${values?.max}` : undefined
        },
      }),
      website: fd.text(s.string().pipe(url()), {
        errorMap({ code }) {
          return code === 'string.url' ? 'Use a full URL' : undefined
        },
      }),
    })
    let view = renderForm(schema, ({ fields }) => (
      <>
        <input step={2} mix={form.control(fields.amount)} />
        <input type="url" mix={form.control(fields.website)} />
      </>
    ))
    t.after(view.cleanup)
    let amount = input(view.container, 'amount')
    let website = input(view.container, 'website')
    edit(amount, '11')
    blur(amount)
    expect(amount.validity.rangeOverflow).toBe(true)
    expect(amount.validity.stepMismatch).toBe(true)
    expect(view.fields.amount.errors).toEqual(['At most 10'])
    edit(amount, '3')
    expect(amount.validity.stepMismatch).toBe(true)
    expect(amount.validity.customError).toBe(false)
    expect(view.fields.amount.errors).toEqual([amount.validationMessage])
    edit(website, 'not-a-url')
    blur(website)
    expect(website.validity.typeMismatch).toBe(true)
    expect(view.fields.website.errors).toEqual(['Use a full URL'])
    website.pattern = 'https://example.com'
    edit(website, 'https://other.com')
    expect(website.validity.patternMismatch).toBe(true)
    expect(website.validity.customError).toBe(false)
  })

  it('maps requiredness on checkboxes, selects, and textareas', (t) => {
    let text = fd.text(s.string(), {
      errorMap: ({ code }) => (code === 'value.required' ? 'Choose a value' : undefined),
    })
    let schema = fd.object({
      choice: text,
      bio: text,
      terms: fd.checkbox(s.literal(true), {
        errorMap({ code, input }) {
          expect(code).toBe('value.required')
          expect(input).toBe(false)
          return 'Accept the terms'
        },
      }),
    })
    let view = renderForm(schema, ({ fields }) => (
      <form mix={form.root()}>
        <select mix={form.control(fields.choice)}>
          <option value="">Choose</option>
        </select>
        <textarea mix={form.control(fields.bio)} />
        <input mix={form.control(fields.terms)} />
      </form>
    ))
    t.after(view.cleanup)
    expect(view.container.querySelector('form')?.checkValidity()).toBe(false)
    expect(view.fields.choice.errors).toEqual(['Choose a value'])
    expect(view.fields.bio.errors).toEqual(['Choose a value'])
    expect(view.fields.terms.errors).toEqual(['Accept the terms'])
  })
})
