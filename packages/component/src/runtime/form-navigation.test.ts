import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createFormNavigationResolver, type FormSubmission } from './form-navigation.ts'

describe('form navigation', () => {
  it('resolves browser form data and submitter overrides', async () => {
    let controller = new AbortController()
    let resolveFormNavigation = createFormNavigationResolver(controller.signal)
    let resolvedSubmission = Promise.withResolvers<FormSubmission>()
    let formNavigation: ReturnType<typeof resolveFormNavigation>

    window.navigation.addEventListener(
      'navigate',
      (event) => {
        let navigation = resolveFormNavigation(event)
        formNavigation = navigation
        let getSubmission = navigation?.getSubmission
        if (!getSubmission) return

        event.intercept({
          async handler() {
            resolvedSubmission.resolve(await getSubmission())
          },
        })
      },
      { signal: controller.signal },
    )

    let destination = new URL(window.location.href)
    destination.searchParams.set('form-navigation', 'submitter-overrides')
    let formDataEventCount = 0
    let form = document.createElement('form')
    form.action = destination.href
    form.method = 'get'
    form.enctype = 'application/x-www-form-urlencoded'
    form.setAttribute('data-target', 'form')
    form.addEventListener('formdata', () => formDataEventCount++)

    let input = document.createElement('input')
    input.name = 'name'
    input.value = 'Ada'
    let button = document.createElement('button')
    button.name = 'intent'
    button.value = 'save'
    button.setAttribute('formmethod', 'post')
    button.setAttribute('formenctype', 'multipart/form-data')
    button.setAttribute('data-submit-target', 'button')
    form.append(input, button)
    document.body.append(form)

    let navigationSucceeded = Promise.withResolvers<void>()
    window.navigation.addEventListener('navigatesuccess', () => navigationSucceeded.resolve(), {
      once: true,
      signal: controller.signal,
    })

    let didNavigate = false
    try {
      form.requestSubmit(button)
      await navigationSucceeded.promise
      didNavigate = true

      expect(formNavigation?.hasAttribute('data-target')).toBe(true)
      expect(formNavigation?.getAttribute('data-target', 'data-submit-target')).toBe('button')
      let submission = await resolvedSubmission.promise
      expect(submission.method).toBe('post')
      expect(submission.encType).toBe('multipart/form-data')
      expect(submission.formData).toBeInstanceOf(FormData)
      expect(Array.from(submission.formData?.entries() ?? [])).toEqual([
        ['name', 'Ada'],
        ['intent', 'save'],
      ])
      expect(formDataEventCount).toBe(1)
    } finally {
      form.remove()
      controller.abort()
      if (didNavigate) await window.navigation.back().finished
    }
  })

  it('preserves a reused submitter when its previous form submits again', async () => {
    let controller = new AbortController()
    let resolveFormNavigation = createFormNavigationResolver(controller.signal)
    let formNavigation: ReturnType<typeof resolveFormNavigation>
    let submitterForm: HTMLFormElement | null | undefined

    let previousForm = document.createElement('form')
    previousForm.addEventListener('submit', (event) => event.preventDefault())
    let form = document.createElement('form')
    form.action = window.location.href
    form.method = 'get'
    form.setAttribute('data-rmx-target', 'items')
    let button = document.createElement('button')
    button.name = 'filter'
    button.value = 'example'
    previousForm.append(button)
    document.body.append(previousForm, form)

    window.navigation.addEventListener(
      'navigate',
      (event) => {
        submitterForm = button.form
        formNavigation = resolveFormNavigation(event)
        event.intercept({ handler: async () => {} })
      },
      { signal: controller.signal },
    )
    let navigationSucceeded = Promise.withResolvers<void>()
    window.navigation.addEventListener('navigatesuccess', () => navigationSucceeded.resolve(), {
      once: true,
      signal: controller.signal,
    })

    let didNavigate = false
    try {
      previousForm.requestSubmit(button)
      form.append(button)
      form.requestSubmit(button)
      button.remove()
      previousForm.requestSubmit()

      await navigationSucceeded.promise
      didNavigate = true

      expect(submitterForm).toBe(null)
      expect(formNavigation?.getAttribute('data-rmx-target')).toBe('items')
      expect(formNavigation?.getSubmission).toBeUndefined()
      expect(new URL(window.location.href).searchParams.get('filter')).toBe('example')
    } finally {
      previousForm.remove()
      form.remove()
      controller.abort()
      if (didNavigate) await window.navigation.back().finished
    }
  })

  it('preserves browser form data when the submitter is detached before navigate fires', async () => {
    let controller = new AbortController()
    let resolveFormNavigation = createFormNavigationResolver(controller.signal)
    let formNavigation: ReturnType<typeof resolveFormNavigation>
    let submission: FormSubmission | undefined
    let submitterForm: HTMLFormElement | null | undefined

    window.navigation.addEventListener(
      'navigate',
      (event) => {
        submitterForm = tempButton.form
        formNavigation = resolveFormNavigation(event)
        event.intercept({
          async handler() {
            submission = await formNavigation?.getSubmission?.()
          },
        })
      },
      { signal: controller.signal },
    )

    let destination = new URL(window.location.href)
    destination.searchParams.set('form-navigation', 'detached-submitter')
    let form = document.createElement('form')
    form.action = destination.href
    form.method = 'post'
    let formDataEventCount = 0
    form.addEventListener('formdata', (event) => {
      formDataEventCount++
      event.formData.set('token', 'native')
    })
    document.body.append(form)

    let input = document.createElement('input')
    input.name = 'name'
    input.value = 'Ada'
    let tempButton = document.createElement('button')
    tempButton.name = 'intent'
    tempButton.value = 'save'
    form.append(input, tempButton)

    let navigationSucceeded = Promise.withResolvers<void>()
    window.navigation.addEventListener('navigatesuccess', () => navigationSucceeded.resolve(), {
      once: true,
      signal: controller.signal,
    })

    let didNavigate = false
    try {
      form.requestSubmit(tempButton)
      tempButton.remove()

      await navigationSucceeded.promise
      didNavigate = true

      expect(submitterForm).toBe(null)
      expect(submission?.method).toBe('post')
      expect(submission?.encType).toBe('application/x-www-form-urlencoded')
      expect(submission?.formData).toBeInstanceOf(FormData)
      expect(Array.from(submission?.formData?.entries() ?? [])).toEqual([
        ['name', 'Ada'],
        ['intent', 'save'],
        ['token', 'native'],
      ])
      expect(formDataEventCount).toBe(1)
    } finally {
      form.remove()
      controller.abort()
      if (didNavigate) await window.navigation.back().finished
    }
  })
})
