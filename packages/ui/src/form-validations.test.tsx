import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { renderToString } from '@remix-run/component/server'
import { render } from '@remix-run/component/test'
import type { Handle } from '@remix-run/component'

import { createFieldMixins, createFormMixins } from './form.ts'

type TestControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

const customValidationDefinition = {
  fields: { username: {} },
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
    return (control: TestControl) => {
      control.setCustomValidity(control.value === 'schema-invalid' ? 'Schema error' : '')
    }
  },
}

describe('custom client validations', () => {
  it('accepts standalone callbacks and reports synchronous failures without invalidating the value', (t) => {
    let failure = new Error('Check unavailable')
    let calls = 0
    let binding = createFieldMixins(customValidationDefinition, {
      name: 'username',
      validations() {
        calls++
        throw failure
      },
    })
    let { container, cleanup } = render(<input mix={binding.field()} />)
    t.after(cleanup)
    let input = container.querySelector('input')
    if (!input) throw new Error('Missing input')
    input.value = 'ada'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(calls).toBe(0)
    expect(binding.pending).toBe(true)
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    expect(calls).toBe(1)
    expect(binding.pending).toBe(false)
    expect(binding.validationError).toBe(failure)
    expect(input.validity.valid).toBe(true)
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    expect(calls).toBe(2)
  })

  it('does not run client callbacks during SSR and preserves native attributes', async () => {
    let checks = 0
    let binding = createFormMixins(customValidationDefinition, {
      validations: {
        username() {
          checks++
          return []
        },
      },
    })
    let html = await renderToString(<input mix={binding.field('username')} />)
    expect(html).toContain('required')
    expect(checks).toBe(0)
    expect(binding.fields.username.pending).toBe(false)
  })

  it('notifies once per synchronous check and does not replace newly invalid native constraints', async (t) => {
    let changes = 0
    let result = Promise.withResolvers<ReadonlyArray<string>>()
    let binding = createFormMixins(customValidationDefinition, {
      onChange: () => changes++,
      validations: {
        username: {
          debounceMs: 0,
          validate(value) {
            return value === 'async' ? result.promise : ['Taken']
          },
        },
      },
    })
    let { container, cleanup } = render(<input mix={binding.field('username')} />)
    t.after(cleanup)
    let input = container.querySelector('input')
    if (!input) throw new Error('Missing input')
    input.value = 'ada'
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    expect(changes).toBe(1)
    input.value = 'async'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.pattern = 'only-this'
    result.resolve(['Taken'])
    await result.promise
    expect(input.validity.patternMismatch).toBe(true)
    expect(input.validity.customError).toBe(false)
    expect(binding.fields.username.errors).toEqual([input.validationMessage])
  })

  it('retains pending checks when reset is canceled and aborts when native input becomes invalid', async (t) => {
    let request: { signal?: AbortSignal } = {}
    let result = Promise.withResolvers<ReadonlyArray<string>>()
    let binding = createFormMixins(customValidationDefinition, {
      validations: {
        username: {
          debounceMs: 0,
          validate(_value, { signal }) {
            request.signal = signal
            return result.promise
          },
        },
      },
    })
    let { container, cleanup } = render(
      <form>
        <input mix={binding.field('username')} />
      </form>,
    )
    t.after(cleanup)
    let input = container.querySelector('input')
    let form = container.querySelector('form')
    if (!input || !form) throw new Error('Missing form')
    input.value = 'ada'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    form.addEventListener('reset', (event) => event.preventDefault(), { once: true })
    form.reset()
    await Promise.resolve()
    expect(request.signal?.aborted).toBe(false)
    expect(binding.fields.username.pending).toBe(true)
    input.value = ''
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(request.signal?.aborted).toBe(true)
    expect(binding.fields.username.pending).toBe(false)
    result.resolve(['Late error'])
    await result.promise
    expect(input.validity.customError).toBe(false)
    expect(input.validity.valueMissing).toBe(true)
  })

  it('reports rejected checks separately and recovers on the next edit', async (t) => {
    let result = Promise.withResolvers<ReadonlyArray<string>>()
    let failure = new Error('Offline')
    let binding = createFormMixins(customValidationDefinition, {
      validations: {
        username: {
          debounceMs: 0,
          validate(value) {
            return value === 'offline' ? result.promise : []
          },
        },
      },
    })
    let { container, cleanup } = render(<input mix={binding.field('username')} />)
    t.after(cleanup)
    let input = container.querySelector('input')
    if (!input) throw new Error('Missing input')
    input.value = 'offline'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    result.reject(failure)
    await result.promise.catch(() => {})
    expect(binding.fields.username.pending).toBe(false)
    expect(binding.fields.username.validationError).toBe(failure)
    expect(binding.fields.username.errors).toEqual([])
    expect(input.validity.valid).toBe(true)
    input.value = 'online'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(binding.fields.username.validationError).toBe(undefined)
    expect(input.validity.valid).toBe(true)
  })

  it('preserves checks across renders and cancels them when a new submission arrives', async (t) => {
    type Submission = { errors: string[] }
    let requests: Array<{
      signal: AbortSignal
      result: ReturnType<typeof Promise.withResolvers<ReadonlyArray<string>>>
    }> = []
    function Example(handle: Handle<{ submission?: Submission }>) {
      let binding = createFormMixins(
        {
          ...customValidationDefinition,
          getFieldErrors(_name: 'username', submission?: Submission) {
            return submission?.errors ?? []
          },
        },
        {
          getSubmission: () => handle.props.submission,
          onChange: () => handle.update(),
          validations: {
            username: {
              debounceMs: 0,
              validate(_value, { signal }) {
                let result = Promise.withResolvers<ReadonlyArray<string>>()
                requests.push({ signal, result })
                return result.promise
              },
            },
          },
        },
      )
      return () => (
        <form mix={binding.form()}>
          <input mix={binding.field('username')} />
          <p mix={binding.error('username')}>{binding.fields.username.errors.join(' ')}</p>
          <output>{binding.fields.username.pending ? 'Checking' : 'Ready'}</output>
        </form>
      )
    }
    let { container, root, cleanup } = render(<Example />)
    t.after(cleanup)
    let input = container.querySelector('input')
    let form = container.querySelector('form')
    if (!input || !form) throw new Error('Missing form')
    input.value = 'ada'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    root.flush()
    expect(container.querySelector('output')?.textContent).toBe('Checking')
    expect(requests[0].signal.aborted).toBe(false)
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    root.flush()
    requests[0].result.resolve(['Client error'])
    await requests[0].result.promise
    root.flush()
    expect(container.querySelector('p')?.textContent).toBe('Client error')
    input.value = 'grace'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    root.render(<Example submission={{ errors: ['Server error'] }} />)
    root.flush()
    expect(requests[1].signal.aborted).toBe(true)
    requests[1].result.resolve(['Late client error'])
    await requests[1].result.promise
    root.flush()
    expect(container.querySelector('p')?.textContent).toBe('Server error')
    expect(container.querySelector('output')?.textContent).toBe('Ready')
    expect(input.validationMessage).toBe('')
    form.reset()
    await Promise.resolve()
    root.flush()
    expect(container.querySelector('p')?.textContent).toBe('')
    expect(input.hasAttribute('data-touched')).toBe(false)
  })

  it('aborts superseded async checks and ignores results that disregard cancellation', async (t) => {
    let requests: Array<{
      value: string
      signal: AbortSignal
      result: ReturnType<typeof Promise.withResolvers<ReadonlyArray<string>>>
    }> = []
    let binding = createFormMixins(customValidationDefinition, {
      validations: {
        username: {
          debounceMs: 0,
          validate(value, { signal }) {
            let result = Promise.withResolvers<ReadonlyArray<string>>()
            requests.push({ value, signal, result })
            return result.promise
          },
        },
      },
    })
    let { container, cleanup } = render(<input mix={binding.field('username')} />)
    t.after(cleanup)
    let input = container.querySelector('input')
    if (!input) throw new Error('Missing input')
    input.value = 'old'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(binding.fields.username.pending).toBe(true)
    expect(input.validity.valid).toBe(true)
    input.value = 'new'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(requests[0].signal.aborted).toBe(true)
    requests[0].result.resolve(['Stale error'])
    await requests[0].result.promise
    expect(input.validationMessage).toBe('')
    expect(binding.fields.username.pending).toBe(true)
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    expect(requests.length).toBe(2)
    requests[1].result.resolve(['Already registered'])
    await requests[1].result.promise
    expect(binding.fields.username.pending).toBe(false)
    expect(binding.fields.username.errors).toEqual(['Already registered'])
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.validationMessage).toBe('Already registered')
  })

  it('debounces typing and flushes the latest value on blur', async (t) => {
    let values: string[] = []
    let binding = createFormMixins(customValidationDefinition, {
      validations: {
        username: {
          debounceMs: 60_000,
          validate(value) {
            values.push(value)
            return ['Taken']
          },
        },
      },
    })
    let { container, cleanup } = render(<input mix={binding.field('username')} />)
    t.after(cleanup)
    let input = container.querySelector('input')
    if (!input) throw new Error('Missing input')
    input.value = 'a'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.value = 'ada'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(values).toEqual([])
    expect(binding.fields.username.pending).toBe(true)
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    expect(values).toEqual(['ada'])
    expect(binding.fields.username.pending).toBe(false)
    expect(binding.fields.username.errors).toEqual(['Taken'])
  })

  it('applies a debounced result before blur without revealing errors', async (t) => {
    let checked = Promise.withResolvers<void>()
    let binding = createFormMixins(customValidationDefinition, {
      validations: {
        username: {
          debounceMs: 1,
          validate() {
            checked.resolve()
            return ['Taken']
          },
        },
      },
    })
    let { container, cleanup } = render(<input mix={binding.field('username')} />)
    t.after(cleanup)
    let input = container.querySelector('input')
    if (!input) throw new Error('Missing input')
    input.value = 'ada'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await checked.promise
    expect(binding.fields.username.pending).toBe(false)
    expect(binding.fields.username.errors).toEqual([])
    expect(input.hasAttribute('aria-invalid')).toBe(false)
    expect(input.checkValidity()).toBe(false)
    expect(binding.fields.username.errors).toEqual(['Taken'])
  })

  it('keeps pending checks non-blocking for native submission and blocks completed failures', async (t) => {
    let result = Promise.withResolvers<ReadonlyArray<string>>()
    let submissions = 0
    let binding = createFormMixins(customValidationDefinition, {
      validations: { username: { debounceMs: 0, validate: () => result.promise } },
    })
    let { container, cleanup } = render(
      <form mix={binding.form()}>
        <input mix={binding.field('username')} />
        <button>Save</button>
      </form>,
    )
    t.after(cleanup)
    let input = container.querySelector('input')
    let form = container.querySelector('form')
    if (!input || !form) throw new Error('Missing form')
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      submissions++
    })
    input.value = 'ada'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    form.requestSubmit()
    expect(submissions).toBe(1)
    result.resolve(['Taken'])
    await result.promise
    form.requestSubmit()
    expect(submissions).toBe(1)
    expect(binding.fields.username.errors).toEqual(['Taken'])
  })

  it('cancels standalone checks on reset and unmount', async (t) => {
    let requests: Array<{
      signal: AbortSignal
      result: ReturnType<typeof Promise.withResolvers<ReadonlyArray<string>>>
    }> = []
    let binding = createFieldMixins(customValidationDefinition, {
      name: 'username',
      validations: {
        debounceMs: 0,
        validate(_value, { signal }) {
          let result = Promise.withResolvers<ReadonlyArray<string>>()
          requests.push({ signal, result })
          return result.promise
        },
      },
    })
    let { container, cleanup } = render(
      <form>
        <input mix={binding.field()} />
      </form>,
    )
    t.after(cleanup)
    let input = container.querySelector('input')
    let form = container.querySelector('form')
    if (!input || !form) throw new Error('Missing form')
    input.value = 'ada'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    form.reset()
    await Promise.resolve()
    expect(requests[0].signal.aborted).toBe(true)
    expect(binding.pending).toBe(false)
    requests[0].result.resolve(['Late reset error'])
    await requests[0].result.promise
    expect(binding.errors).toEqual([])
    expect(binding.touched).toBe(false)
    input.value = 'grace'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    cleanup()
    expect(requests[1].signal.aborted).toBe(true)
    expect(binding.pending).toBe(false)
    requests[1].result.resolve(['Late unmount error'])
    await requests[1].result.promise
    expect(input.validationMessage).toBe('')
  })

  it('runs custom checks after native and schema checks and reveals them after blur', (t) => {
    let values: string[] = []
    let binding = createFormMixins(customValidationDefinition, {
      validations: {
        username: {
          debounceMs: 0,
          validate(value) {
            values.push(value)
            return value === 'taken' ? ['Already registered', 'Choose another name'] : []
          },
        },
      },
    })
    let { container, cleanup } = render(<input mix={binding.field('username')} />)
    t.after(cleanup)
    let input = container.querySelector('input')
    if (!input) throw new Error('Missing input')
    expect(values).toEqual([])
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.value = 'schema-invalid'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(values).toEqual([])
    input.value = 'taken'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(values).toEqual(['taken'])
    expect(input.validationMessage).toBe('Already registered')
    expect(binding.fields.username.errors).toEqual([])
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    expect(binding.fields.username.errors).toEqual(['Already registered', 'Choose another name'])
    expect(input.getAttribute('aria-describedby')).toBe('username-error')
    expect(input.checkValidity()).toBe(false)
    expect(input.validationMessage).toBe('Already registered')
    input.value = 'available'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(binding.fields.username.errors).toEqual([])
    expect(input.checkValidity()).toBe(true)
  })
})
