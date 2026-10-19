import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { render } from '@remix-run/component/test'
import { renderToString } from '@remix-run/component/server'
import { on } from '@remix-run/component'

import { createFieldMixins, createFormMixins, onInputValidation } from './form.ts'
import type { InputValidationEvent } from './form.ts'

type TestControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

const definition = {
  fields: { username: {} },
  getInputAttrs(name: string) {
    return { name, required: true, defaultValue: 'ada' }
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
    return (control: TestControl) => {
      control.setCustomValidity(control.value === 'schema-invalid' ? 'Schema error' : '')
    }
  },
}

describe('setCustomErrors', () => {
  it('updates native validity synchronously, reveals feedback on blur, and survives revalidation', (t) => {
    let changes = 0
    let events: InputValidationEvent[] = []
    let { field, fields } = createFormMixins(definition, { onChange: () => changes++ })
    let { container, cleanup } = render(
      <input
        mix={[
          field('username'),
          onInputValidation((event) => {
            events.push(event)
          }),
        ]}
      />,
    )
    t.after(cleanup)
    let input = container.querySelector('input')
    if (!input) throw new Error('Missing input')

    let messages = ['Already registered', 'Choose another username']
    fields.username.setCustomErrors(messages)
    messages[0] = 'Mutated by application'
    expect(input.validationMessage).toBe('Already registered')
    expect(input.validity.customError).toBe(true)
    expect(fields.username.errors).toEqual([])
    expect(input.hasAttribute('aria-invalid')).toBe(false)
    expect(changes).toBe(0)

    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(fields.username.errors).toEqual(['Already registered', 'Choose another username'])
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toBe('username-error')
    expect(input.checkValidity()).toBe(false)
    expect(changes).toBe(1)
    expect(events.at(-1)?.errors).toEqual(fields.username.errors)

    fields.username.setCustomErrors([])
    expect(input.validity.valid).toBe(true)
    expect(fields.username.errors).toEqual([])
    expect(input.hasAttribute('aria-invalid')).toBe(false)
    expect(input.hasAttribute('aria-describedby')).toBe(false)
    expect(changes).toBe(2)
  })

  it('keeps native and schema errors primary without losing supplemental messages', (t) => {
    let binding = createFieldMixins(definition, { name: 'username' })
    let { container, cleanup } = render(<input mix={binding.field()} />)
    t.after(cleanup)
    let input = container.querySelector('input')
    if (!input) throw new Error('Missing input')

    binding.setCustomErrors(['Business error'])
    input.pattern = 'grace'
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    expect(binding.errors).toEqual([input.validationMessage, 'Business error'])
    expect(input.validity.patternMismatch).toBe(true)
    input.removeAttribute('pattern')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(binding.errors).toEqual(['Business error'])
    expect(input.validationMessage).toBe('Business error')

    input.value = 'schema-invalid'
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    binding.setCustomErrors(['Business error'])
    expect(binding.errors).toEqual(['Schema error', 'Business error'])
    expect(input.validationMessage).toBe('Schema error')
    binding.setCustomErrors([])
    expect(binding.errors).toEqual(['Schema error'])

    input.value = ''
    input.dispatchEvent(new Event('input', { bubbles: true }))
    let nativeMessage = input.validationMessage
    binding.setCustomErrors(['Business error'])
    expect(binding.errors).toEqual([nativeMessage, 'Business error'])
    expect(input.validity.valueMissing).toBe(true)
    expect(input.validationMessage).toBe(nativeMessage)
    binding.setCustomErrors([])
    expect(input.validity.valueMissing).toBe(true)
    expect(binding.errors).toEqual([nativeMessage])
  })

  it('clears messages only when the value changes, regardless of input listener order', (t) => {
    let first = createFieldMixins(definition, { name: 'first' })
    let second = createFieldMixins(definition, { name: 'second' })
    let { container, cleanup } = render(
      <>
        <input
          mix={[on('input', () => first.setCustomErrors(['First custom error'])), first.field()]}
        />
        <input
          mix={[second.field(), on('input', () => second.setCustomErrors(['Second custom error']))]}
        />
      </>,
    )
    t.after(cleanup)
    let inputs = container.querySelectorAll('input')
    let firstInput = inputs[0]
    let secondInput = inputs[1]
    firstInput.value = 'grace'
    secondInput.value = 'grace'
    firstInput.dispatchEvent(new Event('input', { bubbles: true }))
    secondInput.dispatchEvent(new Event('input', { bubbles: true }))
    expect(firstInput.validationMessage).toBe('First custom error')
    expect(secondInput.validationMessage).toBe('Second custom error')

    firstInput.dispatchEvent(new Event('change', { bubbles: true }))
    expect(firstInput.validationMessage).toBe('First custom error')
    firstInput.value = 'lin'
    firstInput.dispatchEvent(new Event('change', { bubbles: true }))
    expect(firstInput.validity.valid).toBe(true)
    expect(first.errors).toEqual([])
    expect(secondInput.validationMessage).toBe('Second custom error')
  })

  it('scopes errors to select/textarea values and checkbox checked state', (t) => {
    let choice = createFieldMixins(definition, { name: 'choice' })
    let bio = createFieldMixins(definition, { name: 'bio' })
    let terms = createFieldMixins(definition, { name: 'terms' })
    let { container, cleanup } = render(
      <form>
        <select mix={choice.field()}>
          <option value="ada" selected>
            Ada
          </option>
          <option value="grace">Grace</option>
        </select>
        <textarea mix={bio.field()} />
        <input type="checkbox" defaultChecked mix={terms.field()} />
      </form>,
    )
    t.after(cleanup)
    let select = container.querySelector('select')
    let textarea = container.querySelector('textarea')
    let checkbox = container.querySelector('input')
    if (!select || !textarea || !checkbox) throw new Error('Missing controls')
    choice.setCustomErrors(['Choice error'])
    bio.setCustomErrors(['Bio error'])
    terms.setCustomErrors(['Terms error'])
    select.value = 'grace'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    textarea.value = 'Updated'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    checkbox.checked = false
    checkbox.dispatchEvent(new Event('change', { bubbles: true }))
    expect(select.validity.customError).toBe(false)
    expect(textarea.validity.customError).toBe(false)
    expect(checkbox.validity.customError).toBe(false)
    expect(checkbox.validity.valueMissing).toBe(true)
  })

  it('preserves errors across renders and canceled resets, but clears on a native reset', async (t) => {
    let binding = createFieldMixins(definition, { name: 'username' })
    let { container, root, cleanup } = render(
      <form>
        <input mix={binding.field()} />
      </form>,
    )
    t.after(cleanup)
    let input = container.querySelector('input')
    let form = container.querySelector('form')
    if (!input || !form) throw new Error('Missing form')
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    binding.setCustomErrors(['Taken'])
    root.render(
      <form>
        <input mix={binding.field()} />
      </form>,
    )
    root.flush()
    expect(binding.errors).toEqual(['Taken'])
    expect(input.validationMessage).toBe('Taken')
    form.addEventListener('reset', (event) => event.preventDefault(), { once: true })
    form.reset()
    await Promise.resolve()
    expect(binding.errors).toEqual(['Taken'])
    expect(input.validationMessage).toBe('Taken')
    form.reset()
    await Promise.resolve()
    expect(binding.touched).toBe(false)
    expect(binding.errors).toEqual([])
    expect(input.validity.valid).toBe(true)
  })

  it('clears custom validity for new submissions and resets the latest feedback', async (t) => {
    type Submission = { errors: string[] }
    let submission: Submission | undefined
    let changes = 0
    let binding = createFieldMixins(
      {
        ...definition,
        getFieldErrors(_name: string, submission?: Submission) {
          return submission?.errors ?? []
        },
      },
      { name: 'username', getSubmission: () => submission, onChange: () => changes++ },
    )
    let { container, root, cleanup } = render(
      <form>
        <input mix={binding.field()} />
      </form>,
    )
    t.after(cleanup)
    let input = container.querySelector('input')
    let form = container.querySelector('form')
    if (!input || !form) throw new Error('Missing form')
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    binding.setCustomErrors(['Client error'])
    expect(changes).toBe(2)
    submission = { errors: ['Server error'] }
    root.render(
      <form>
        <input mix={binding.field()} />
      </form>,
    )
    root.flush()
    expect(input.validationMessage).toBe('')
    expect(binding.errors).toEqual(['Server error'])
    expect(binding.touched).toBe(false)
    expect(changes).toBe(2)
    binding.setCustomErrors(['Another client error'])
    expect(input.validationMessage).toBe('Another client error')
    expect(binding.errors).toEqual(['Server error'])
    form.reset()
    await Promise.resolve()
    expect(binding.errors).toEqual([])
    expect(input.hasAttribute('aria-invalid')).toBe(false)
  })

  it('blocks native submission without transient valid feedback notifications', (t) => {
    let snapshots: boolean[] = []
    let { form, field, fields } = createFormMixins(definition)
    let { container, cleanup } = render(
      <form mix={form()}>
        <input
          mix={[
            field('username'),
            onInputValidation((event) => {
              snapshots.push(event.currentTarget.validity.valid)
            }),
          ]}
        />
        <button>Save</button>
      </form>,
    )
    t.after(cleanup)
    let element = container.querySelector('form')
    if (!element) throw new Error('Missing form')
    let submissions = 0
    element.addEventListener('submit', (event) => {
      event.preventDefault()
      submissions++
    })
    fields.username.setCustomErrors(['Taken'])
    element.requestSubmit()
    expect(submissions).toBe(0)
    expect(fields.username.touched).toBe(true)
    expect(fields.username.errors).toEqual(['Taken'])
    expect(snapshots).toEqual([false, false])
    fields.username.setCustomErrors([])
    element.requestSubmit()
    expect(submissions).toBe(1)
  })

  it('supports pre-mount messages without SSR effects and ignores empty messages', async (t) => {
    let binding = createFieldMixins(definition, { name: 'username' })
    binding.setCustomErrors(['', 'Taken'])
    let html = await renderToString(<input mix={binding.field()} />)
    expect(html).not.toContain('aria-invalid')
    expect(binding.errors).toEqual([])
    let { container, cleanup } = render(<input mix={binding.field()} />)
    t.after(cleanup)
    let input = container.querySelector('input')
    if (!input) throw new Error('Missing input')
    expect(input.validationMessage).toBe('Taken')
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    expect(binding.errors).toEqual(['Taken'])
    binding.setCustomErrors([''])
    expect(input.validity.valid).toBe(true)
  })

  it('restores custom validity if a schema validator throws', (t) => {
    let shouldThrow = false
    let binding = createFieldMixins(
      {
        ...definition,
        createInputValidator() {
          return (_control: TestControl) => {
            if (shouldThrow) throw new Error('Schema failure')
          }
        },
      },
      { name: 'username' },
    )
    let { container, cleanup } = render(<input mix={binding.field()} />)
    t.after(cleanup)
    let input = container.querySelector('input')
    if (!input) throw new Error('Missing input')
    binding.setCustomErrors(['Taken'])
    shouldThrow = true
    expect(() => binding.setCustomErrors(['Still taken'])).toThrow('Schema failure')
    expect(input.validity.valid).toBe(false)
    expect(input.validationMessage).toBe('Taken')
    shouldThrow = false
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    expect(binding.errors).toEqual(['Still taken'])
  })

  it('does not mutate removed controls and drops errors when remounted with another value', (t) => {
    let binding = createFieldMixins(definition, { name: 'username' })
    let { container, root, cleanup } = render(<input mix={binding.field()} />)
    t.after(cleanup)
    let original = container.querySelector('input')
    if (!original) throw new Error('Missing input')
    binding.setCustomErrors(['Taken'])
    root.render(null)
    root.flush()
    binding.setCustomErrors(['Updated while removed'])
    expect(original.validationMessage).toBe('Taken')
    root.render(<input defaultValue="grace" mix={binding.field()} />)
    root.flush()
    let replacement = container.querySelector('input')
    if (!replacement) throw new Error('Missing replacement input')
    expect(replacement.validationMessage).toBe('Updated while removed')
    root.render(null)
    root.flush()
    root.render(<input defaultValue="lin" mix={binding.field()} />)
    root.flush()
    let last = container.querySelector('input')
    if (!last) throw new Error('Missing last input')
    expect(last.validity.valid).toBe(true)
  })

  it('applies errors synchronously when a new submission is read before rerendering', (t) => {
    let submission: { errors: string[] } = { errors: [] }
    let binding = createFieldMixins(
      {
        ...definition,
        getFieldErrors(_name: string, value?: typeof submission) {
          return value?.errors ?? []
        },
      },
      { name: 'username', getSubmission: () => submission },
    )
    let { container, cleanup } = render(<input mix={binding.field()} />)
    t.after(cleanup)
    let input = container.querySelector('input')
    if (!input) throw new Error('Missing input')
    binding.setCustomErrors(['Old error'])
    submission = { errors: [] }
    binding.setCustomErrors(['New error'])
    expect(input.validationMessage).toBe('New error')
  })

  it('composes application-owned async checks with event signals and reset/submission guards', async (t) => {
    let submission = {}
    let resetVersion = 0
    let requests: Array<{
      signal: AbortSignal
      result: ReturnType<typeof Promise.withResolvers<boolean>>
    }> = []
    let { form, field, fields } = createFormMixins(definition, {
      getSubmission: () => submission,
    })
    let { container, cleanup } = render(
      <form
        mix={[
          form(),
          on('reset', () => {
            resetVersion++
          }),
        ]}
      >
        <input
          mix={[
            field('username'),
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
      </form>,
    )
    t.after(cleanup)
    let input = container.querySelector('input')
    let element = container.querySelector('form')
    if (!input || !element) throw new Error('Missing form')
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    input.value = 'old'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.value = 'new'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(requests[0].signal.aborted).toBe(true)
    requests[0].result.resolve(false)
    await requests[0].result.promise
    expect(input.validity.valid).toBe(true)
    requests[1].result.resolve(false)
    await requests[1].result.promise
    expect(fields.username.errors).toEqual(['Taken'])

    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(fields.username.errors).toEqual(['Taken'])
    requests[2].result.resolve(true)
    await requests[2].result.promise
    expect(fields.username.errors).toEqual([])

    input.value = 'ada'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    element.reset()
    requests[3].result.resolve(false)
    await requests[3].result.promise
    expect(input.validity.valid).toBe(true)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    submission = {}
    requests[4].result.resolve(false)
    await requests[4].result.promise
    expect(input.validity.valid).toBe(true)
    expect(fields.username.errors).toEqual([])
  })
})
