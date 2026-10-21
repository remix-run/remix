import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { render } from '@remix-run/component/test'
import * as s from '@remix-run/data-schema'
import { email, max, min, minLength, url } from '@remix-run/data-schema/checks'
import { createField, createFieldMixins, createForm, createFormMixins } from './form.ts'

describe('field errorMap', () => {
  it('maps native messages immediately and reveals the same inline message after blur', (t) => {
    let contexts: s.ErrorMapContext[] = []
    let Email = createField({
      schema: s.string().pipe(email()),
      label: 'Email',
      type: 'email',
      name: 'account.email',
      errorMap(context) {
        contexts.push(context)
        if (context.code === 'value.required') return 'Enter your email'
        if (context.code === 'string.email') return 'Use a valid email address'
      },
    })
    let binding = createFieldMixins(Email, { name: 'email' })
    let { container, cleanup } = render(<input mix={binding.field()} />)
    t.after(cleanup)
    let input = container.querySelector('input')
    if (!input) throw new Error('Missing input')
    expect(input.validationMessage).toBe('Enter your email')
    expect(binding.errors).toEqual([])
    expect(binding.touched).toBe(false)
    input.value = 'invalid'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(input.validity.typeMismatch).toBe(true)
    expect(input.validationMessage).toBe('Use a valid email address')
    expect(binding.errors).toEqual([])
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    expect(binding.errors).toEqual(['Use a valid email address'])
    expect(input.getAttribute('aria-describedby')).toBe('email-error')
    expect(contexts.at(-1)?.path).toEqual(['email'])
    expect(contexts.at(-1)?.input).toBe('invalid')
    input.value = 'ada@example.com'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(input.validity.valid).toBe(true)
    expect(input.validationMessage).toBe('')
    expect(binding.errors).toEqual([])
  })

  it('composes mapped native and refinement errors with untouched supplemental errors', (t) => {
    let Signup = createForm({
      fields: {
        age: {
          schema: s
            .number()
            .pipe(min(13))
            .refine((value) => value !== 42),
          label: 'Age',
          type: 'number',
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
      },
    })
    let { field, fields } = createFormMixins(Signup)
    let { container, cleanup } = render(
      <form>
        <input mix={field('age')} />
      </form>,
    )
    t.after(cleanup)
    let input = container.querySelector('input')
    let form = container.querySelector('form')
    if (!input || !form) throw new Error('Missing form')
    input.value = '12'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    fields.age.setCustomErrors(['Application error'])
    expect(input.validationMessage).toBe('You must be at least 13')
    expect(form.checkValidity()).toBe(false)
    expect(fields.age.errors).toEqual(['You must be at least 13', 'Application error'])
    input.value = '42'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(fields.age.errors).toEqual(['Choose another age'])
    fields.age.setCustomErrors(['Application error'])
    expect(fields.age.errors).toEqual(['Choose another age', 'Application error'])
    input.value = '37'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(input.validity.valid).toBe(true)
    expect(fields.age.errors).toEqual([])
  })

  it('preserves explicit refinement messages in native validity and visible feedback', (t) => {
    let Username = createField({
      schema: s.string().refine((value) => value !== 'admin', 'Reserved username'),
      label: 'Username',
      type: 'text',
      errorMap() {
        throw new Error('Explicit refinement messages must bypass errorMap')
      },
    })
    let binding = createFieldMixins(Username, { name: 'username' })
    let { container, cleanup } = render(<input defaultValue="admin" mix={binding.field()} />)
    t.after(cleanup)
    let input = container.querySelector('input')
    if (!input) throw new Error('Missing input')
    expect(input.validationMessage).toBe('Reserved username')
    expect(binding.errors).toEqual([])
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    expect(binding.errors).toEqual(['Reserved username'])
    expect(input.getAttribute('aria-invalid')).toBe('true')
  })

  it('uses deterministic native priority and preserves browser wording on fallback', (t) => {
    let codes: string[] = []
    let Email = createField({
      schema: s.string().pipe(minLength(20)),
      label: 'Email',
      type: 'email',
      errorMap({ code }) {
        codes.push(code)
        if (code === 'string.email') return 'Invalid email'
      },
    })
    let binding = createFieldMixins(Email, { name: 'email' })
    let { container, cleanup } = render(<input pattern=".*@example.com" mix={binding.field()} />)
    t.after(cleanup)
    let input = container.querySelector('input')
    if (!input) throw new Error('Missing input')
    input.value = 'bad'
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    expect(input.validity.typeMismatch).toBe(true)
    expect(input.validity.patternMismatch).toBe(true)
    expect(codes.at(-1)).toBe('string.email')
    expect(binding.errors).toEqual(['Invalid email'])
    input.value = 'long-enough-address@elsewhere.com'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(input.validity.customError).toBe(false)
    expect(input.validity.patternMismatch).toBe(true)
    expect(binding.errors).toEqual([input.validationMessage])
    input.removeAttribute('pattern')
    input.value = ''
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(input.validity.valueMissing).toBe(true)
    expect(input.validity.customError).toBe(false)
    expect(codes.at(-1)).toBe('value.required')
    expect(binding.errors).toEqual([input.validationMessage])
  })

  it('maps numeric upper bounds and URL failures but leaves step failures native', (t) => {
    let Number = createField({
      schema: s.number().pipe(max(10)),
      label: 'Number',
      type: 'number',
      errorMap({ code, values }) {
        if (code === 'number.max') return `At most ${values?.max}`
        return 'Mapped error'
      },
    })
    let Website = createField({
      schema: s.string().pipe(url()),
      label: 'Website',
      type: 'url',
      errorMap({ code }) {
        if (code === 'string.url') return 'Use a full URL'
      },
    })
    let number = createFieldMixins(Number, { name: 'number' })
    let website = createFieldMixins(Website, { name: 'website' })
    let { container, cleanup } = render(
      <>
        <input step={2} mix={number.field()} />
        <input mix={website.field()} />
      </>,
    )
    t.after(cleanup)
    let numericInput = container.querySelector('input[type=number]')
    let urlInput = container.querySelector('input[type=url]')
    if (!(numericInput instanceof HTMLInputElement) || !(urlInput instanceof HTMLInputElement))
      throw new Error('Missing controls')
    numericInput.value = '11'
    numericInput.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    expect(numericInput.validity.rangeOverflow).toBe(true)
    expect(numericInput.validity.stepMismatch).toBe(true)
    expect(number.errors).toEqual(['At most 10'])
    numericInput.value = '3'
    numericInput.dispatchEvent(new Event('input', { bubbles: true }))
    expect(numericInput.validity.stepMismatch).toBe(true)
    expect(numericInput.validity.customError).toBe(false)
    expect(number.errors).toEqual([numericInput.validationMessage])
    urlInput.value = 'not-a-url'
    urlInput.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    expect(urlInput.validity.typeMismatch).toBe(true)
    expect(website.errors).toEqual(['Use a full URL'])
  })

  it('maps requiredness on checkboxes, selects, and textareas', (t) => {
    let Text = createField({
      schema: s.string(),
      label: 'Text',
      type: 'text',
      errorMap: ({ code }) => (code === 'value.required' ? 'Choose a value' : undefined),
    })
    let Terms = createField({
      schema: s.literal(true),
      label: 'Terms',
      type: 'checkbox',
      errorMap({ code, input }) {
        expect(code).toBe('value.required')
        expect(input).toBe(false)
        return 'Accept the terms'
      },
    })
    let choice = createFieldMixins(Text, { name: 'choice' })
    let bio = createFieldMixins(Text, { name: 'bio' })
    let terms = createFieldMixins(Terms, { name: 'terms' })
    let { container, cleanup } = render(
      <form>
        <select mix={choice.field()}>
          <option value="">Choose</option>
          <option value="ada">Ada</option>
        </select>
        <textarea mix={bio.field()} />
        <input mix={terms.field()} />
      </form>,
    )
    t.after(cleanup)
    let form = container.querySelector('form')
    if (!form) throw new Error('Missing form')
    expect(form.checkValidity()).toBe(false)
    expect(choice.errors).toEqual(['Choose a value'])
    expect(bio.errors).toEqual(['Choose a value'])
    expect(terms.errors).toEqual(['Accept the terms'])
  })
})
