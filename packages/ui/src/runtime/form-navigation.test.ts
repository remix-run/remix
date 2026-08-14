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
})
