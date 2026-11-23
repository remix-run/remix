import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createFormNavigationResolver, type FormSubmission } from './frame.ts'

describe('form navigation', () => {
  it('retains the navigation submitter when formdata was not observed', async () => {
    let controller = new AbortController()
    let resolveFormNavigation = createFormNavigationResolver(controller.signal)
    let formNavigation: ReturnType<typeof resolveFormNavigation>
    let submission: FormSubmission | undefined
    window.navigation.addEventListener(
      'navigate',
      (event) => {
        formNavigation = resolveFormNavigation(event)
        let getSubmission = formNavigation?.getSubmission
        event.intercept({
          async handler() {
            submission = await getSubmission?.()
          },
        })
      },
      { signal: controller.signal },
    )
    let form = document.createElement('form')
    form.action = window.location.href
    form.method = 'get'
    // Exercise the Navigation API source without a cached native formdata event.
    document.addEventListener('formdata', (event) => event.stopImmediatePropagation(), {
      capture: true,
      signal: controller.signal,
    })
    let button = document.createElement('button')
    button.formMethod = 'post'
    button.formEnctype = 'text/plain'
    button.name = 'intent'
    button.value = 'save'
    form.append(button)
    document.body.append(form)
    let navigated = false
    try {
      let succeeded = nextNavigation(controller.signal)
      form.requestSubmit(button)
      await succeeded
      navigated = true

      expect(formNavigation?.form).toBe(form)
      expect(formNavigation?.submitter).toBe(button)
      expect(submission?.method).toBe('post')
      expect(submission?.encType).toBe('text/plain')
    } finally {
      form.remove()
      controller.abort()
      if (navigated) await window.navigation.back().finished
    }
  })

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
      expect(formNavigation?.form).toBe(form)
      expect(formNavigation?.submitter).toBe(button)
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

  it('resolves an external submit button associated by its form attribute', async () => {
    let controller = new AbortController()
    let resolveFormNavigation = createFormNavigationResolver(controller.signal)
    let initialKey = window.navigation.currentEntry?.key
    let formNavigation: ReturnType<typeof resolveFormNavigation>
    let submission: FormSubmission | undefined

    let container = document.createElement('div')
    container.innerHTML = `
      <form
        id="external-submitter-form"
        action=""
        method="get"
        enctype="application/x-www-form-urlencoded"
        data-rmx-target="form-frame"
      >
        <input name="name" value="Ada" />
      </form>
      <button
        type="submit"
        form="external-submitter-form"
        name="intent"
        value="save"
        formmethod="post"
        formenctype="multipart/form-data"
        data-rmx-target="button-frame"
      >Save</button>
    `
    let button = container.querySelector('button')
    if (!button) throw new Error('Expected an external submit button')
    document.body.append(container)

    window.navigation.addEventListener(
      'navigate',
      (event) => {
        formNavigation = resolveFormNavigation(event)
        event.intercept({
          async handler() {
            submission = await formNavigation?.getSubmission?.()
          },
        })
      },
      { signal: controller.signal },
    )

    try {
      let navigationSucceeded = nextNavigation(controller.signal)
      button.click()
      await navigationSucceeded

      expect(formNavigation?.getAttribute('data-rmx-target')).toBe('button-frame')
      expect(submission?.method).toBe('post')
      expect(submission?.encType).toBe('multipart/form-data')
      expect(Array.from(submission?.formData?.entries() ?? [])).toEqual([
        ['name', 'Ada'],
        ['intent', 'save'],
      ])
    } finally {
      container.remove()
      controller.abort()
      if (initialKey) await window.navigation.traverseTo(initialKey).finished
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
      expect(formNavigation?.form).toBe(form)
      expect(formNavigation?.submitter).toBe(button)
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

  it('preserves a newer submission on the same form when an older POST callback completes', async () => {
    let controller = new AbortController()
    let resolveFormNavigation = createFormNavigationResolver(controller.signal)
    let formNavigation: ReturnType<typeof resolveFormNavigation>
    let initialKey = window.navigation.currentEntry?.key

    let form = document.createElement('form')
    form.action = window.location.href
    form.method = 'post'
    form.setAttribute('data-rmx-target', 'form')
    let oldButton = document.createElement('button')
    oldButton.name = 'intent'
    oldButton.value = 'first'
    let newButton = document.createElement('button')
    newButton.name = 'intent'
    newButton.value = 'second'
    newButton.setAttribute('data-rmx-target', 'new-submitter')
    form.append(oldButton, newButton)
    document.body.append(form)

    window.navigation.addEventListener(
      'navigate',
      (event) => {
        formNavigation = resolveFormNavigation(event)
        event.intercept({ handler: async () => {} })
      },
      { signal: controller.signal },
    )

    try {
      let firstNavigation = nextNavigation(controller.signal)
      form.requestSubmit(oldButton)
      await firstNavigation
      let finishOldPost = formNavigation?.getSubmission
      expect(finishOldPost).toBeDefined()

      let secondNavigation = nextNavigation(controller.signal)
      form.requestSubmit(newButton)
      newButton.remove()
      // Complete the old callback after the new submit, but before its navigate event.
      let firstSubmission = await finishOldPost?.()
      await secondNavigation

      expect(newButton.form).toBe(null)
      expect(formNavigation?.getAttribute('data-rmx-target')).toBe('new-submitter')
      let secondSubmission = await formNavigation?.getSubmission?.()
      expect(Array.from(firstSubmission?.formData?.entries() ?? [])).toEqual([['intent', 'first']])
      expect(Array.from(secondSubmission?.formData?.entries() ?? [])).toEqual([
        ['intent', 'second'],
      ])
    } finally {
      form.remove()
      controller.abort()
      if (initialKey) await window.navigation.traverseTo(initialKey).finished
    }
  })

  it('preserves a submitter reused by another form when an older POST callback completes', async () => {
    let controller = new AbortController()
    let resolveFormNavigation = createFormNavigationResolver(controller.signal)
    let formNavigation: ReturnType<typeof resolveFormNavigation>
    let initialKey = window.navigation.currentEntry?.key

    let previousForm = document.createElement('form')
    previousForm.action = window.location.href
    previousForm.method = 'post'
    let form = document.createElement('form')
    form.action = window.location.href
    form.method = 'post'
    form.setAttribute('data-rmx-target', 'new-form')
    let button = document.createElement('button')
    button.name = 'intent'
    button.value = 'first'
    previousForm.append(button)
    document.body.append(previousForm, form)

    window.navigation.addEventListener(
      'navigate',
      (event) => {
        formNavigation = resolveFormNavigation(event)
        event.intercept({ handler: async () => {} })
      },
      { signal: controller.signal },
    )

    try {
      let firstNavigation = nextNavigation(controller.signal)
      previousForm.requestSubmit(button)
      await firstNavigation
      let finishOldPost = formNavigation?.getSubmission
      expect(finishOldPost).toBeDefined()

      form.append(button)
      button.value = 'second'
      let secondNavigation = nextNavigation(controller.signal)
      form.requestSubmit(button)
      button.remove()
      let firstSubmission = await finishOldPost?.()
      await secondNavigation

      expect(button.form).toBe(null)
      expect(formNavigation?.getAttribute('data-rmx-target')).toBe('new-form')
      let secondSubmission = await formNavigation?.getSubmission?.()
      expect(Array.from(firstSubmission?.formData?.entries() ?? [])).toEqual([['intent', 'first']])
      expect(Array.from(secondSubmission?.formData?.entries() ?? [])).toEqual([
        ['intent', 'second'],
      ])
    } finally {
      previousForm.remove()
      form.remove()
      controller.abort()
      if (initialKey) await window.navigation.traverseTo(initialKey).finished
    }
  })

  it('preserves original POST data across unrelated FormData snapshots', async () => {
    let controller = new AbortController()
    let resolveFormNavigation = createFormNavigationResolver(controller.signal)
    let initialKey = window.navigation.currentEntry?.key
    let submission: FormSubmission | undefined
    let submitSnapshot: FormData | undefined

    let form = document.createElement('form')
    form.action = window.location.href
    form.method = 'post'
    let input = document.createElement('input')
    input.name = 'name'
    input.value = 'draft'
    let button = document.createElement('button')
    button.name = 'intent'
    button.value = 'save'
    form.append(input, button)
    document.body.append(form)
    form.addEventListener('submit', () => {
      submitSnapshot = new FormData(form)
      input.value = 'Ada'
    })

    window.navigation.addEventListener(
      'navigate',
      (event) => {
        let formNavigation = resolveFormNavigation(event)
        event.intercept({
          async handler() {
            submission = await formNavigation?.getSubmission?.()
          },
        })
      },
      { signal: controller.signal },
    )

    try {
      let navigationSucceeded = nextNavigation(controller.signal)
      form.requestSubmit(button)
      button.remove()
      input.value = 'Grace'
      let laterSnapshot = new FormData(form)
      await navigationSucceeded

      expect(submitSnapshot?.get('name')).toBe('draft')
      expect(laterSnapshot.get('name')).toBe('Grace')
      expect(submission?.method).toBe('post')
      expect(Array.from(submission?.formData?.entries() ?? [])).toEqual([
        ['name', 'Ada'],
        ['intent', 'save'],
      ])
    } finally {
      form.remove()
      controller.abort()
      if (initialKey) await window.navigation.traverseTo(initialKey).finished
    }
  })

  it('uses the navigation body when the native snapshot was blocked before an unrelated snapshot', async () => {
    let controller = new AbortController()
    let resolveFormNavigation = createFormNavigationResolver(controller.signal)
    let initialKey = window.navigation.currentEntry?.key
    let formNavigation: ReturnType<typeof resolveFormNavigation>
    let submission: FormSubmission | undefined
    let navigationFormData: FormData | null = null
    let form = document.createElement('form')
    form.action = window.location.href
    form.method = 'post'
    let button = document.createElement('button')
    button.name = 'intent'
    button.value = 'save'
    form.append(button)
    document.body.append(form)

    document.addEventListener(
      'formdata',
      (event) => {
        button.disabled = true
        event.stopImmediatePropagation()
      },
      { capture: true, once: true, signal: controller.signal },
    )
    window.navigation.addEventListener(
      'navigate',
      (event) => {
        navigationFormData = event.formData
        formNavigation = resolveFormNavigation(event)
        event.intercept({
          async handler() {
            submission = await formNavigation?.getSubmission?.()
          },
        })
      },
      { signal: controller.signal },
    )

    try {
      let navigationSucceeded = nextNavigation(controller.signal)
      form.requestSubmit(button)
      document.addEventListener(
        'formdata',
        (event) => {
          event.formData.append('intent', 'unrelated')
          event.formData.append('intent', 'also unrelated')
        },
        { capture: true, once: true, signal: controller.signal },
      )
      expect(new FormData(form).getAll('intent')).toEqual(['unrelated', 'also unrelated'])
      await navigationSucceeded

      expect(navigationFormData).toBeInstanceOf(FormData)
      expect(formNavigation?.submission.formData).toBe(navigationFormData)
      expect(submission?.formData).toBe(navigationFormData)
    } finally {
      form.remove()
      controller.abort()
      if (initialKey) await window.navigation.traverseTo(initialKey).finished
    }
  })

  it('preserves the original submission when a reused submitter has a later canceled submit', async () => {
    let controller = new AbortController()
    let resolveFormNavigation = createFormNavigationResolver(controller.signal)
    let initialKey = window.navigation.currentEntry?.key
    let formNavigation: ReturnType<typeof resolveFormNavigation>
    let submission: FormSubmission | undefined
    let destination: string | undefined

    let form = document.createElement('form')
    let url = new URL(window.location.href)
    url.searchParams.set('form-navigation', 'original-submission')
    form.action = url.href
    form.method = 'post'
    form.setAttribute('data-rmx-target', 'original-frame')
    let canceledForm = document.createElement('form')
    canceledForm.method = 'get'
    canceledForm.setAttribute('data-rmx-target', 'canceled-frame')
    canceledForm.addEventListener('submit', (event) => event.preventDefault())
    let input = document.createElement('input')
    input.name = 'name'
    input.value = 'Ada'
    let button = document.createElement('button')
    button.name = 'intent'
    button.value = 'save'
    form.append(input, button)
    document.body.append(form, canceledForm)

    window.navigation.addEventListener(
      'navigate',
      (event) => {
        destination = event.destination.url
        formNavigation = resolveFormNavigation(event)
        event.intercept({
          async handler() {
            submission = await formNavigation?.getSubmission?.()
          },
        })
      },
      { signal: controller.signal },
    )

    try {
      let navigationSucceeded = nextNavigation(controller.signal)
      form.requestSubmit(button)
      canceledForm.append(button)
      canceledForm.requestSubmit(button)
      new FormData(canceledForm)
      button.remove()
      await navigationSucceeded

      expect(destination).toBe(url.href)
      expect(formNavigation?.getAttribute('data-rmx-target')).toBe('original-frame')
      expect(submission?.method).toBe('post')
      expect(Array.from(submission?.formData?.entries() ?? [])).toEqual([
        ['name', 'Ada'],
        ['intent', 'save'],
      ])
    } finally {
      form.remove()
      canceledForm.remove()
      controller.abort()
      if (initialKey) await window.navigation.traverseTo(initialKey).finished
    }
  })

  it('preserves a pending GET when the same form has a canceled duplicate submit', async () => {
    let controller = new AbortController()
    let resolveFormNavigation = createFormNavigationResolver(controller.signal)
    let initialKey = window.navigation.currentEntry?.key
    let formNavigation: ReturnType<typeof resolveFormNavigation>
    let destination: string | undefined

    let form = document.createElement('form')
    form.action = window.location.href
    form.method = 'get'
    let button = document.createElement('button')
    button.name = 'intent'
    button.value = 'search'
    button.setAttribute('data-rmx-target', 'original-frame')
    form.append(button)
    document.body.append(form)

    window.navigation.addEventListener(
      'navigate',
      (event) => {
        destination = event.destination.url
        formNavigation = resolveFormNavigation(event)
        event.intercept({ handler: async () => {} })
      },
      { signal: controller.signal },
    )

    try {
      let navigationSucceeded = nextNavigation(controller.signal)
      form.requestSubmit(button)
      form.addEventListener('submit', (event) => event.preventDefault(), { once: true })
      form.requestSubmit(button)
      button.remove()
      await navigationSucceeded

      expect(button.form).toBe(null)
      expect(formNavigation?.getAttribute('data-rmx-target')).toBe('original-frame')
      expect(formNavigation?.getSubmission).toBeUndefined()
      expect(destination).toBeDefined()
      expect(new URL(destination ?? '').searchParams.get('intent')).toBe('search')
    } finally {
      form.remove()
      controller.abort()
      if (initialKey) await window.navigation.traverseTo(initialKey).finished
    }
  })

  it('preserves a pending POST when the same form has a canceled submit with another button', async () => {
    let controller = new AbortController()
    let resolveFormNavigation = createFormNavigationResolver(controller.signal)
    let initialKey = window.navigation.currentEntry?.key
    let formNavigation: ReturnType<typeof resolveFormNavigation>
    let submission: FormSubmission | undefined

    let form = document.createElement('form')
    form.action = window.location.href
    form.method = 'post'
    let input = document.createElement('input')
    input.name = 'name'
    input.value = 'Ada'
    let button = document.createElement('button')
    button.name = 'intent'
    button.value = 'save'
    button.setAttribute('formenctype', 'multipart/form-data')
    button.setAttribute('data-rmx-target', 'original-frame')
    let canceledButton = document.createElement('button')
    canceledButton.name = 'intent'
    canceledButton.value = 'search'
    canceledButton.setAttribute('formmethod', 'get')
    canceledButton.setAttribute('data-rmx-target', 'canceled-frame')
    form.append(input, button, canceledButton)
    document.body.append(form)

    window.navigation.addEventListener(
      'navigate',
      (event) => {
        formNavigation = resolveFormNavigation(event)
        event.intercept({
          async handler() {
            submission = await formNavigation?.getSubmission?.()
          },
        })
      },
      { signal: controller.signal },
    )

    try {
      let navigationSucceeded = nextNavigation(controller.signal)
      form.requestSubmit(button)
      input.value = 'Grace'
      form.addEventListener('submit', (event) => event.preventDefault(), { once: true })
      form.requestSubmit(canceledButton)
      button.remove()
      new FormData(form)
      await navigationSucceeded

      expect(button.form).toBe(null)
      expect(formNavigation?.getAttribute('data-rmx-target')).toBe('original-frame')
      expect(submission?.method).toBe('post')
      expect(submission?.encType).toBe('multipart/form-data')
      expect(Array.from(submission?.formData?.entries() ?? [])).toEqual([
        ['name', 'Ada'],
        ['intent', 'save'],
      ])
    } finally {
      form.remove()
      controller.abort()
      if (initialKey) await window.navigation.traverseTo(initialKey).finished
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
      expect(formNavigation?.form).toBe(form)
      expect(formNavigation?.submitter).toBe(tempButton)
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

  it('preserves the submitter entry when pending UI disables and renames the button', async () => {
    let controller = new AbortController()
    let resolveFormNavigation = createFormNavigationResolver(controller.signal)
    let formNavigation: ReturnType<typeof resolveFormNavigation>
    let submission: FormSubmission | undefined

    window.navigation.addEventListener(
      'navigate',
      (event) => {
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
    destination.searchParams.set('form-navigation', 'disabled-submitter')
    let form = document.createElement('form')
    form.action = destination.href
    form.method = 'post'
    let input = document.createElement('input')
    input.name = 'title'
    input.value = 'x'
    let button = document.createElement('button')
    button.name = 'intent'
    button.value = 'save'
    let replacement = document.createElement('input')
    replacement.type = 'hidden'
    replacement.name = 'intent'
    replacement.value = 'pending'
    replacement.disabled = true
    form.append(input, button, replacement)
    form.addEventListener(
      'formdata',
      () => {
        // The native submission's entry list already contains the original button entry.
        button.disabled = true
        button.name = 'pending-intent'
        replacement.disabled = false
      },
      { once: true },
    )
    document.body.append(form)

    let didNavigate = false
    try {
      let navigationSucceeded = nextNavigation(controller.signal)
      form.requestSubmit(button)
      // Firefox runs the default action of a synthetic submit on a connected form.
      form.addEventListener('submit', () => form.remove(), { once: true })
      form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, submitter: button }))
      document.body.append(form)
      await navigationSucceeded
      didNavigate = true

      expect(button.disabled).toBe(true)
      expect(Array.from(formNavigation?.submission.formData?.entries() ?? [])).toEqual([
        ['title', 'x'],
        ['intent', 'save'],
      ])
      expect(Array.from(submission?.formData?.entries() ?? [])).toEqual([
        ['title', 'x'],
        ['intent', 'save'],
      ])
    } finally {
      form.remove()
      controller.abort()
      if (didNavigate) await window.navigation.back().finished
    }
  })

  it('uses the current body when a direct POST supersedes a tracked submission', async () => {
    let controller = new AbortController()
    let resolveFormNavigation = createFormNavigationResolver(controller.signal)
    let formNavigation: ReturnType<typeof resolveFormNavigation>
    let submission: FormSubmission | undefined
    let initialKey = window.navigation.currentEntry?.key
    let destination = new URL(window.location.href)
    destination.searchParams.set('form-navigation', 'direct-post')

    window.navigation.addEventListener(
      'navigate',
      (event) => {
        let resolved = resolveFormNavigation(event)
        event.intercept({
          async handler() {
            if (event.destination.url !== destination.href) return
            formNavigation = resolved
            submission = await resolved?.getSubmission?.()
          },
        })
      },
      { signal: controller.signal },
    )

    let form = document.createElement('form')
    form.method = 'post'
    form.action = window.location.href
    let input = document.createElement('input')
    input.name = 'title'
    input.value = 'draft'
    form.append(input)
    document.body.append(form)

    try {
      let navigationSucceeded = nextNavigation(controller.signal, destination.href)
      form.requestSubmit()
      input.value = 'published'
      form.action = destination.href
      form.submit()
      await navigationSucceeded

      expect(formNavigation?.submission.formData?.get('title')).toBe('published')
      expect(submission?.formData?.get('title')).toBe('published')
    } finally {
      form.remove()
      controller.abort()
      if (initialKey) await window.navigation.traverseTo(initialKey).finished
    }
  })

  it('uses navigation form data when the newest submit was not captured', async () => {
    let controller = new AbortController()
    let resolveFormNavigation = createFormNavigationResolver(controller.signal)
    let submission: FormSubmission | undefined
    let initialKey = window.navigation.currentEntry?.key
    let destination = new URL(window.location.href)
    destination.searchParams.set('form-navigation', 'uncaptured-post')

    window.navigation.addEventListener(
      'navigate',
      (event) => {
        let resolved = resolveFormNavigation(event)
        event.intercept({
          async handler() {
            if (event.destination.url === destination.href) {
              submission = await resolved?.getSubmission?.()
            }
          },
        })
      },
      { signal: controller.signal },
    )

    let form = document.createElement('form')
    form.method = 'post'
    form.action = window.location.href
    let button = document.createElement('button')
    button.name = 'intent'
    button.value = 'save'
    form.append(button)
    document.addEventListener(
      'formdata',
      (event) => {
        if (event.target === form && button.value === 'publish') event.stopImmediatePropagation()
      },
      { capture: true, signal: controller.signal },
    )
    document.body.append(form)

    try {
      let navigationSucceeded = nextNavigation(controller.signal, destination.href)
      form.requestSubmit(button)
      button.value = 'publish'
      form.action = destination.href
      form.requestSubmit(button)
      await navigationSucceeded

      expect(submission?.formData?.get('intent')).toBe('publish')
    } finally {
      form.remove()
      controller.abort()
      if (initialKey) await window.navigation.traverseTo(initialKey).finished
    }
  })
})

function nextNavigation(signal: AbortSignal, url?: string): Promise<void> {
  return new Promise((resolve) => {
    function onSuccess() {
      if (url !== undefined && window.location.href !== url) return
      window.navigation.removeEventListener('navigatesuccess', onSuccess)
      resolve()
    }
    window.navigation.addEventListener('navigatesuccess', onSuccess, { signal })
  })
}
