import { describe, it, expect, beforeEach } from 'vitest'

import { events } from '../lib/events.ts'
import { formReset } from './form-reset.ts'

describe('formReset interaction', () => {
  let form: HTMLFormElement
  let input: HTMLInputElement
  let select: HTMLSelectElement
  let textarea: HTMLTextAreaElement
  let nonFormElement: HTMLDivElement

  beforeEach(() => {
    // Create a form with various form controls
    form = document.createElement('form')

    input = document.createElement('input')
    input.type = 'text'
    input.name = 'testInput'
    input.value = 'initial value'

    select = document.createElement('select')
    select.name = 'testSelect'
    let option1 = document.createElement('option')
    option1.value = 'option1'
    option1.textContent = 'Option 1'
    let option2 = document.createElement('option')
    option2.value = 'option2'
    option2.textContent = 'Option 2'
    option2.selected = true
    select.appendChild(option1)
    select.appendChild(option2)

    textarea = document.createElement('textarea')
    textarea.name = 'testTextarea'
    textarea.value = 'initial textarea content'

    // Add form controls to the form
    form.appendChild(input)
    form.appendChild(select)
    form.appendChild(textarea)

    // Create a non-form element for testing
    nonFormElement = document.createElement('div')

    // Add the form to the document so form associations work
    document.body.appendChild(form)
    document.body.appendChild(nonFormElement)
  })

  it('triggers on form reset for input element', () => {
    let resetCalled = false
    let receivedEvent: any = null

    let cleanup = events(input, [
      formReset((event) => {
        resetCalled = true
        receivedEvent = event
      }),
    ])

    // Reset the form
    form.reset()

    expect(resetCalled).toBe(true)
    expect(receivedEvent.detail.originalEvent.type).toBe('reset')
    expect(receivedEvent.detail.form).toBe(form)

    cleanup()
  })

  it('triggers on form reset for select element', () => {
    let resetCalled = false
    let receivedEvent: any = null

    let cleanup = events(select, [
      formReset((event) => {
        resetCalled = true
        receivedEvent = event
      }),
    ])

    // Reset the form
    form.reset()

    expect(resetCalled).toBe(true)
    expect(receivedEvent.detail.originalEvent.type).toBe('reset')
    expect(receivedEvent.detail.form).toBe(form)

    cleanup()
  })

  it('triggers on form reset for textarea element', () => {
    let resetCalled = false
    let receivedEvent: any = null

    let cleanup = events(textarea, [
      formReset((event) => {
        resetCalled = true
        receivedEvent = event
      }),
    ])

    // Reset the form
    form.reset()

    expect(resetCalled).toBe(true)
    expect(receivedEvent.detail.originalEvent.type).toBe('reset')
    expect(receivedEvent.detail.form).toBe(form)

    cleanup()
  })

  it('does not trigger for elements not in a form', () => {
    let resetCalled = false

    let cleanup = events(nonFormElement, [
      formReset(() => {
        resetCalled = true
      }),
    ])

    // Try to reset the form
    form.reset()

    expect(resetCalled).toBe(false)

    cleanup()
  })

  it('does not trigger after cleanup', () => {
    let resetCalled = false

    let cleanup = events(input, [
      formReset(() => {
        resetCalled = true
      }),
    ])

    // Clean up the interaction
    cleanup()

    // Reset the form
    form.reset()

    expect(resetCalled).toBe(false)
  })

  it('works with form elements created dynamically', () => {
    // Create a new input element and add it to the form
    let dynamicInput = document.createElement('input')
    dynamicInput.type = 'text'
    dynamicInput.name = 'dynamicInput'
    form.appendChild(dynamicInput)

    let resetCalled = false
    let receivedEvent: any = null

    let cleanup = events(dynamicInput, [
      formReset((event) => {
        resetCalled = true
        receivedEvent = event
      }),
    ])

    // Reset the form
    form.reset()

    expect(resetCalled).toBe(true)
    expect(receivedEvent.detail.form).toBe(form)

    cleanup()
  })

  it('handles form reset event properties correctly', () => {
    let receivedEvent: any = null

    let cleanup = events(input, [
      formReset((event) => {
        receivedEvent = event
      }),
    ])

    // Reset the form
    form.reset()

    expect(receivedEvent).toBeTruthy()
    expect(receivedEvent.detail).toBeTruthy()
    expect(receivedEvent.detail.originalEvent).toBeTruthy()
    expect(receivedEvent.detail.originalEvent.type).toBe('reset')
    expect(receivedEvent.detail.originalEvent.target).toBe(form)
    expect(receivedEvent.detail.form).toBe(form)

    cleanup()
  })

  it('works with elements outside form that reference form via form attribute', () => {
    // Create an input outside the form but associated via form attribute
    let externalInput = document.createElement('input')
    externalInput.type = 'text'
    externalInput.name = 'externalInput'
    externalInput.setAttribute('form', 'test-form-id')

    // Give the form an ID
    form.id = 'test-form-id'

    // Add the external input to the document (but not inside the form)
    document.body.appendChild(externalInput)

    let resetCalled = false
    let receivedEvent: any = null

    let cleanup = events(externalInput, [
      formReset((event) => {
        resetCalled = true
        receivedEvent = event
      }),
    ])

    // Reset the form
    form.reset()

    expect(resetCalled).toBe(true)
    expect(receivedEvent.detail.form).toBe(form)

    cleanup()
    document.body.removeChild(externalInput)
  })

  it('multiple form elements can listen to the same form reset', () => {
    let input1Calls = 0
    let input2Calls = 0
    let selectCalls = 0

    let cleanup1 = events(input, [
      formReset(() => {
        input1Calls++
      }),
    ])

    // Create another input in the same form
    let input2 = document.createElement('input')
    input2.type = 'email'
    input2.name = 'email'
    form.appendChild(input2)

    let cleanup2 = events(input2, [
      formReset(() => {
        input2Calls++
      }),
    ])

    let cleanup3 = events(select, [
      formReset(() => {
        selectCalls++
      }),
    ])

    // Reset the form once
    form.reset()

    expect(input1Calls).toBe(1)
    expect(input2Calls).toBe(1)
    expect(selectCalls).toBe(1)

    cleanup1()
    cleanup2()
    cleanup3()
  })
})
