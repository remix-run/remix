import { getTopFrame, getNamedFrame } from './run.ts'
import type { FrameReloadOptions } from './component.ts'

type NavigationState = {
  target: string | undefined
  src: string
  resetScroll: boolean
  $rmx: true
}

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

type RuntimeNavigation = {
  state: NavigationState
  getReloadOptions?: () => FrameReloadOptions | Promise<FrameReloadOptions>
  replaceHistory?: boolean
}

interface FormSubmissionNavigationInfo {
  type: typeof formSubmissionNavigationInfoType
  state: NavigationState
  getReloadOptions(): FrameReloadOptions | Promise<FrameReloadOptions>
}

interface NavigationPrecommitControllerLike {
  redirect(url: string, options: { history: 'replace' }): void
}

interface NavigationInterceptOptionsWithPrecommit extends NavigationInterceptOptions {
  handler(): Promise<void>
  precommitHandler(controller: NavigationPrecommitControllerLike): void
}

const PENDING_FORM_SUBMISSION_TIMEOUT = 1000
const formSubmissionNavigationInfoType = 'frame-form-submission'

/**
 * Options for client-side frame-aware navigation.
 */
export type NavigationOptions = {
  src?: string
  target?: string
  history?: 'push' | 'replace'
  resetScroll?: boolean
}

/**
 * Performs a Navigation API transition understood by Remix frame runtime state.
 *
 * @param href Destination URL.
 * @param options Navigation options.
 */
export async function navigate(href: string, options?: NavigationOptions) {
  let state = {
    target: options?.target,
    src: options?.src ?? href,
    resetScroll: options?.resetScroll !== false,
    $rmx: true,
  } satisfies NavigationState
  let transition = window.navigation.navigate(href, { state, history: options?.history })
  await transition.finished
}

/**
 * Starts listening for Navigation API transitions and routes them through frame reloads.
 *
 * @param signal Abort signal used to remove the listener.
 * @param canResolveFrames Whether the runtime has a resolver that can handle intercepted navigations.
 * @returns void
 */
export function startNavigationListener(signal: AbortSignal, canResolveFrames = true) {
  if (!canResolveFrames) return
  return startNavigationListenerImpl(signal, { getTopFrame, getNamedFrame })
}

// Internal version used by unit tests so we can inject stub frames
export function startNavigationListenerImpl(
  signal: AbortSignal,
  options: {
    getTopFrame: typeof getTopFrame
    getNamedFrame: typeof getNamedFrame
  },
) {
  let navigation = window.navigation
  let pendingFormSubmissions = new WeakMap<HTMLFormElement, PendingFormSubmission>()
  let supportsPrecommit = typeof Reflect.get(window, 'NavigationPrecommitController') === 'function'

  navigation.updateCurrentEntry({
    state: { target: undefined, src: window.location.href, resetScroll: true, $rmx: true },
  })

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
      let onFormData = (event: FormDataEvent) => {
        let pending = pendingFormSubmissions.get(form)
        if (pending) pending.formData = event.formData
      }
      form.addEventListener('formdata', onFormData)
      let pending: PendingFormSubmission = {
        submitter:
          eventSubmitter instanceof HTMLButtonElement || eventSubmitter instanceof HTMLInputElement
            ? eventSubmitter
            : null,
        timeout: setTimeout(() => {
          if (pendingFormSubmissions.get(form) === pending) {
            pendingFormSubmissions.delete(form)
          }
          pending.removeFormDataListener()
        }, PENDING_FORM_SUBMISSION_TIMEOUT),
        removeFormDataListener() {
          form.removeEventListener('formdata', onFormData)
        },
      }
      pendingFormSubmissions.set(form, pending)
    },
    { capture: true, signal },
  )

  navigation.addEventListener(
    'navigate',
    (event) => {
      // Safari seems to incorrectly set canIntercept to true for sub-domain navigations, so
      // we do a host check ourselves/. The spec is clear that a different host should prevent
      // interception so this is likely a bug in Safari:
      // https://html.spec.whatwg.org/multipage/nav-history-apis.html#can-have-its-url-rewritten
      if (!event.canIntercept || isCrossOriginDestination(event)) return

      let replayedSubmission = isFormSubmissionNavigationInfo(event.info) ? event.info : undefined
      let runtimeNavigation = replayedSubmission
        ? {
            state: replayedSubmission.state,
            getReloadOptions: replayedSubmission.getReloadOptions,
          }
        : getRuntimeNavigation(event, pendingFormSubmissions)
      if (!runtimeNavigation) return
      let { state } = runtimeNavigation

      let topFrame = options.getTopFrame()
      let namedFrame = state.target ? options.getNamedFrame(state.target) : undefined
      let frame = namedFrame ?? topFrame

      let handler = async () => {
        if (event.navigationType !== 'traverse') {
          navigation.updateCurrentEntry({ state })
        }

        frame.src = frame === topFrame ? event.destination.url : state.src
        await frame.reload({
          ...(await runtimeNavigation.getReloadOptions?.()),
          signal: event.signal,
        })

        let isNewEntry = event.navigationType === 'push' || event.navigationType === 'replace'
        if (state.resetScroll && isNewEntry) {
          window.scrollTo(0, 0)
        }
      }

      if (runtimeNavigation.replaceHistory && replayedSubmission == null) {
        if (supportsPrecommit) {
          let interceptOptions: NavigationInterceptOptionsWithPrecommit = {
            handler,
            precommitHandler(controller) {
              controller.redirect(event.destination.url, { history: 'replace' })
            },
          }
          event.intercept(interceptOptions)
          return
        }

        if (event.cancelable && runtimeNavigation.getReloadOptions) {
          event.preventDefault()
          navigation.navigate(event.destination.url, {
            history: 'replace',
            state,
            info: {
              type: formSubmissionNavigationInfoType,
              state,
              getReloadOptions: runtimeNavigation.getReloadOptions,
            } satisfies FormSubmissionNavigationInfo,
          })
          return
        }
      }

      event.intercept({ handler })
    },
    { signal },
  )
}

function isRuntimeNavigation(info: unknown): info is NavigationState {
  return typeof info === 'object' && info != null && '$rmx' in info
}

function isFormSubmissionNavigationInfo(value: unknown): value is FormSubmissionNavigationInfo {
  return (
    typeof value === 'object' &&
    value != null &&
    'type' in value &&
    value.type === formSubmissionNavigationInfoType &&
    'state' in value &&
    isRuntimeNavigation(value.state) &&
    'getReloadOptions' in value &&
    typeof value.getReloadOptions === 'function'
  )
}

function isCrossOriginDestination(event: NavigateEvent): boolean {
  let destination = new URL(event.destination.url)
  return destination.origin !== window.location.origin
}

function getRuntimeNavigation(
  event: NavigateEvent,
  pendingFormSubmissions: WeakMap<HTMLFormElement, PendingFormSubmission>,
): RuntimeNavigation | undefined {
  if (event.navigationType === 'traverse') {
    let state = getTraverseNavigationState(event)
    return state ? { state } : undefined
  }

  let sourceNavigation = getSourceElementNavigation(event, pendingFormSubmissions)
  if (sourceNavigation) return sourceNavigation

  let destinationState = event.destination.getState()
  if (isRuntimeNavigation(destinationState)) return { state: destinationState }
}

function getTraverseNavigationState(event: NavigateEvent): NavigationState | undefined {
  let destinationState = event.destination.getState()
  if (isRuntimeNavigation(destinationState)) {
    return destinationState
  }

  // Safari returns `null` for destination.getState(), even though its in the
  // navigation.entries(), so we do its job for it and look it up.
  let navigation = window.navigation
  let matchingEntry = navigation.entries().find((entry) => entry.key === event.destination.key)
  if (matchingEntry) {
    let state = matchingEntry.getState()
    if (isRuntimeNavigation(state)) {
      return state
    }
  }

  return undefined
}

function getSourceElementNavigation(
  event: NavigateEvent,
  pendingFormSubmissions: WeakMap<HTMLFormElement, PendingFormSubmission>,
): RuntimeNavigation | undefined {
  let sourceEvent = event as SourceElementNavigateEvent
  let sourceElement = sourceEvent.sourceElement
  if (!(sourceElement instanceof Element)) return

  let linkElement = sourceElement.closest('a, area')
  if (linkElement instanceof Element) {
    if (linkElement.hasAttribute('rmx-document')) return
    if (linkElement.hasAttribute('download')) return

    return {
      state: {
        target: linkElement.getAttribute('rmx-target') ?? undefined,
        src: linkElement.getAttribute('rmx-src') ?? event.destination.url,
        resetScroll: linkElement.getAttribute('rmx-reset-scroll') !== 'false',
        $rmx: true,
      },
    }
  }

  let form = getSourceForm(sourceElement)
  if (!form) return

  let pending = pendingFormSubmissions.get(form)

  let submitter = pending?.submitter ?? getSourceSubmitter(sourceElement)
  if (hasSubmissionAttribute(form, submitter, 'rmx-document')) return

  let method = getFormMethod(form, submitter)
  let nativeTarget = getSubmissionAttribute(form, submitter, 'target', 'formtarget')
  if (method === 'dialog' || nativeTarget?.toLowerCase() === '_blank') return

  let formEvent = event as FormNavigateEvent

  return {
    state: {
      target: getSubmissionAttribute(form, submitter, 'rmx-target') ?? undefined,
      src: getSubmissionAttribute(form, submitter, 'rmx-src') ?? event.destination.url,
      resetScroll: getSubmissionAttribute(form, submitter, 'rmx-reset-scroll') !== 'false',
      $rmx: true,
    },
    replaceHistory: method.toLowerCase() !== 'get',
    async getReloadOptions() {
      // Chromium dispatches `formdata` after `navigate`; let the browser provide the
      // submitted entry list instead of constructing another FormData and firing a duplicate event.
      if (!formEvent.formData && pending && !pending.formData) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0))
      }
      if (pending) {
        clearTimeout(pending.timeout)
        pending.removeFormDataListener()
        if (pendingFormSubmissions.get(form) === pending) {
          pendingFormSubmissions.delete(form)
        }
      }
      return {
        formData: formEvent.formData ?? pending?.formData,
        method,
        encType: getFormEncType(form, submitter),
      }
    },
  }
}

function getSourceForm(sourceElement: Element): HTMLFormElement | undefined {
  if (sourceElement instanceof HTMLFormElement) return sourceElement
  return getSourceSubmitter(sourceElement)?.form ?? undefined
}

function getSourceSubmitter(sourceElement: Element): SubmitterElement | null {
  let submitter = sourceElement.closest('button, input')
  if (submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement) {
    return submitter
  }
  return null
}

function hasSubmissionAttribute(
  form: HTMLFormElement,
  submitter: SubmitterElement | null,
  name: string,
): boolean {
  return submitter?.hasAttribute(name) === true || form.hasAttribute(name)
}

function getSubmissionAttribute(
  form: HTMLFormElement,
  submitter: SubmitterElement | null,
  name: string,
  submitterName = name,
): string | null {
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
