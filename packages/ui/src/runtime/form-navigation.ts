type SourceElementNavigateEvent = NavigateEvent & {
  sourceElement?: Element | null
}

type FormNavigateEvent = SourceElementNavigateEvent & {
  formData?: FormData | null
}

type SubmitterElement = HTMLButtonElement | HTMLInputElement

type PendingFormSubmission = {
  submitter: SubmitterElement | null
  formData?: FormData
  timeout: ReturnType<typeof setTimeout>
  removeFormDataListener(): void
}

type PendingNavigationSource = {
  element: Element
}

interface NavigationSource {
  sourceElement: Element | undefined
  formNavigation: FormNavigation | undefined
}

/** Browser-provided data for an intercepted form submission. */
export interface FormSubmission {
  /** Submitted form entries for non-GET submissions, when available. */
  formData: FormData | undefined
  /** Effective form method, including submitter overrides. */
  method: string
  /** Effective form encoding type, including submitter overrides. */
  encType: string
}

/** Metadata and deferred submission data for an intercepted form navigation. */
export interface FormNavigation {
  /** Checks the submitter before the form for a submission attribute. */
  hasAttribute(name: string): boolean
  /** Reads a submission attribute, preferring the submitter-specific name when provided. */
  getAttribute(name: string, submitterName?: string): string | null
  /** Resolves browser-generated data for a non-GET submission. */
  getSubmission: (() => Promise<FormSubmission>) | undefined
}

const PENDING_FORM_SUBMISSION_TIMEOUT = 1000

/**
 * Tracks native form events and resolves their corresponding Navigation API events.
 *
 * @param signal Signal used to stop tracking form events.
 * @returns A function that resolves form metadata for a navigation event.
 */
export function createFormNavigationResolver(
  signal: AbortSignal,
): (event: NavigateEvent) => FormNavigation | undefined {
  let resolveNavigationSource = createNavigationSourceResolver(signal)
  return (event) => resolveNavigationSource(event).formNavigation
}

/**
 * Tracks native activation events and resolves their corresponding Navigation API source.
 *
 * @param signal Signal used to stop tracking activation events.
 * @returns A function that resolves source and form metadata for a navigation event.
 */
export function createNavigationSourceResolver(
  signal: AbortSignal,
): (event: NavigateEvent) => NavigationSource {
  let pendingFormSubmissions = new WeakMap<HTMLFormElement, PendingFormSubmission>()
  let pendingNavigationSource: PendingNavigationSource | undefined

  let setPendingNavigationSource = (element: Element) => {
    let pending = { element }
    pendingNavigationSource = pending
    queueMicrotask(() => {
      if (pendingNavigationSource === pending) pendingNavigationSource = undefined
    })
  }

  document.addEventListener(
    'click',
    (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return
      }
      let target = event.target
      if (!(target instanceof Element)) return
      let link = target.closest('a, area')
      if (link) setPendingNavigationSource(link)
    },
    { capture: true, signal },
  )

  // Cache the authoritative submitter for the matching `navigate` event and, for Chromium's
  // non-POST-to-POST override case, the later `formdata` event. Unmatched submits expire.
  document.addEventListener(
    'submit',
    (event) => {
      let form = event.target
      if (!(form instanceof HTMLFormElement)) return

      let existing = pendingFormSubmissions.get(form)
      if (existing) {
        clearTimeout(existing.timeout)
        existing.removeFormDataListener()
      }

      let eventSubmitter = event instanceof SubmitEvent ? event.submitter : null
      let submitter =
        eventSubmitter instanceof HTMLButtonElement || eventSubmitter instanceof HTMLInputElement
          ? eventSubmitter
          : null
      setPendingNavigationSource(submitter ?? form)
      let removeFormDataListener = () => {}
      let method = getFormMethod(form, submitter).toLowerCase()
      // Chromium omits formData from the `navigate` event when a submitter overrides a non-POST form
      // to POST, so we have to capture that via the `formdata` event so we can grab it from the
      // `navigate` event handler
      if (method === 'post' && form.method.toLowerCase() !== 'post') {
        let onFormData = (event: FormDataEvent) => {
          let pending = pendingFormSubmissions.get(form)
          if (pending) pending.formData = event.formData
        }
        form.addEventListener('formdata', onFormData, { signal })
        removeFormDataListener = () => form.removeEventListener('formdata', onFormData)
      }
      let pending: PendingFormSubmission = {
        submitter,
        timeout: setTimeout(() => {
          if (pendingFormSubmissions.get(form) === pending) {
            pendingFormSubmissions.delete(form)
          }
          pending.removeFormDataListener()
        }, PENDING_FORM_SUBMISSION_TIMEOUT),
        removeFormDataListener,
      }
      pendingFormSubmissions.set(form, pending)
    },
    { capture: true, signal },
  )

  return (event) => {
    let sourceEvent = event as SourceElementNavigateEvent
    let sourceElement =
      'sourceElement' in sourceEvent
        ? sourceEvent.sourceElement instanceof Element
          ? sourceEvent.sourceElement
          : undefined
        : pendingNavigationSource?.element
    pendingNavigationSource = undefined

    let form = sourceElement ? getSourceForm(sourceElement) : undefined
    if (!form) return { sourceElement, formNavigation: undefined }

    let pending = pendingFormSubmissions.get(form)
    let submitter = pending?.submitter ?? null
    let method = getFormMethod(form, submitter)
    let encType = getFormEncType(form, submitter)
    let target = getSubmissionAttribute(form, submitter, 'target', 'formtarget')
    if (method === 'dialog' || target?.toLowerCase() === '_blank') {
      return { sourceElement, formNavigation: undefined }
    }

    let formEvent = event as FormNavigateEvent
    let clearPending = () => {
      if (!pending) return
      clearTimeout(pending.timeout)
      pending.removeFormDataListener()
      if (pendingFormSubmissions.get(form) === pending) {
        pendingFormSubmissions.delete(form)
      }
    }
    let getSubmission: FormNavigation['getSubmission']
    if (method.toLowerCase() === 'get') {
      clearPending()
    } else {
      getSubmission = async () => {
        // Chromium may dispatch `formdata` after `navigate` for submitter-overridden POSTs.
        if (!formEvent.formData && pending && !pending.formData) {
          await new Promise<void>((resolve) => setTimeout(resolve, 0))
        }
        clearPending()
        return {
          formData: formEvent.formData ?? pending?.formData,
          method,
          encType,
        }
      }
    }
    let formNavigation = {
      hasAttribute(name) {
        return submitter?.hasAttribute(name) === true || form.hasAttribute(name)
      },
      getAttribute(name, submitterName) {
        return getSubmissionAttribute(form, submitter, name, submitterName)
      },
      getSubmission,
    } satisfies FormNavigation
    return { sourceElement, formNavigation }
  }
}

function getSourceForm(sourceElement: Element): HTMLFormElement | undefined {
  // A form navigation's source element is the submitted form or its submit button.
  // https://html.spec.whatwg.org/multipage/nav-history-apis.html#dom-navigateevent-sourceelement
  if (sourceElement instanceof HTMLFormElement) return sourceElement
  if (sourceElement instanceof HTMLButtonElement || sourceElement instanceof HTMLInputElement) {
    return sourceElement.form ?? undefined
  }
}

function getSubmissionAttribute(
  form: HTMLFormElement,
  submitter: SubmitterElement | null,
  name: string,
  submitterName?: string,
): string | null {
  submitterName ??= name
  if (submitter?.hasAttribute(submitterName)) {
    return submitter.getAttribute(submitterName)
  }
  return form.getAttribute(name)
}

function getFormMethod(form: HTMLFormElement, submitter: SubmitterElement | null): string {
  if (submitter?.hasAttribute('formmethod')) {
    return submitter.formMethod
  }
  return form.method
}

function getFormEncType(form: HTMLFormElement, submitter: SubmitterElement | null): string {
  if (submitter?.hasAttribute('formenctype')) {
    return submitter.formEnctype
  }
  return form.enctype
}
