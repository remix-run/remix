import { addEventListeners, type Handle, type RemixNode } from '@remix-run/ui'
import { createFormNavigationResolver, type FormSubmission } from '../runtime/form-navigation.ts'
import {
  getLinkNavigationElement,
  getReplaceHistory,
  interceptNavigation,
  type NavigationReplacement,
} from '../runtime/navigation-event.ts'

/**
 * Options accepted by the {@link SPA} component and {@link createSPA} utility.
 */
export interface SPAProps {
  /** Content rendered until the initial URL resolves. */
  fallback: RemixNode
  /** Router that resolves browser URLs to renderable UI. */
  router: {
    /**
     * Resolves a URL to renderable UI.
     *
     * @param url Destination URL.
     * @param init Request options, including the navigation signal and submitted form data.
     * @returns The UI for the destination.
     */
    fetch(url: URL, init: RequestInit): Promise<RemixNode>
  }
}

/**
 * Navigation state provided to descendants of the {@link SPA} component.
 */
export interface SPAContext {
  /** URL represented by the currently rendered UI. */
  readonly active: URL
  /** URL currently being loaded, or `undefined` when navigation is idle. */
  readonly pending: URL | undefined
}

/**
 * Live SPA state used by custom SPA component implementations.
 */
export interface SPAMeta {
  /** Stable navigation state suitable for a component context. */
  readonly context: SPAContext
  /** Currently rendered router output, or the fallback during the initial load. */
  readonly node: RemixNode
}

interface FormSubmissionNavigationInfo {
  type: typeof formSubmissionNavigationInfoType
  getSubmission(): Promise<FormSubmission>
}

const formSubmissionNavigationInfoType = 'spa-form-submission'

/**
 * Renders browser URLs through a URL-to-node router and intercepts same-origin navigations.
 *
 * Form submissions use their native method. Non-GET submissions include their `FormData` and
 * replace the current history entry when submitted to the active URL. Submissions to a different
 * URL push a new entry. Navigation history entries do not retain submitted `FormData`, so history
 * traversals revisit form destinations with `GET` requests. Links and forms can use
 * `rmx-document` to bypass SPA interception or `rmx-history` to control history behavior.
 *
 * @param handle Component handle containing the router and initial fallback.
 * @returns A render function for the active router output.
 */
export function SPA(handle: Handle<SPAProps, SPAContext>): () => RemixNode {
  let spa = createSPA(handle, handle.props)
  handle.context.set(spa.context)
  return () => spa.node
}

/**
 * Creates SPA navigation state for use in a component setup scope.
 *
 * @param handle Component handle that owns the SPA navigation lifecycle.
 * @param options Router and fallback UI used to resolve browser URLs.
 * @returns Live SPA navigation state and rendered UI.
 */
export function createSPA(handle: Handle<unknown, unknown>, options: SPAProps): SPAMeta {
  let node = options.fallback
  let currentController: AbortController | undefined
  let active = new URL(window.location.href)
  let pending: URL | undefined
  let resolveFormNavigation: ReturnType<typeof createFormNavigationResolver>
  let context: SPAContext = {
    get active() {
      return active
    },
    get pending() {
      return pending
    },
  }

  function onNavigate(navigateEvent: NavigateEvent): void {
    if (!navigateEvent.canIntercept) return
    if (navigateEvent.hashChange) return
    if (navigateEvent.downloadRequest) return

    let destination = new URL(navigateEvent.destination.url)
    if (destination.origin !== window.location.origin) return

    let replayedSubmission = isFormSubmissionNavigationInfo(navigateEvent.info)
      ? navigateEvent.info
      : undefined
    let linkElement = replayedSubmission ? undefined : getLinkNavigationElement(navigateEvent)
    let formNavigation = replayedSubmission ? undefined : resolveFormNavigation(navigateEvent)
    if (linkElement?.hasAttribute('rmx-document')) return
    if (formNavigation?.hasAttribute('rmx-document')) return

    let getSubmission = replayedSubmission?.getSubmission ?? formNavigation?.getSubmission
    let replaceHistoryByDefault =
      formNavigation?.getSubmission !== undefined && destination.href === active.href
    let replaceHistory =
      replayedSubmission == null &&
      getReplaceHistory(
        linkElement?.getAttribute('rmx-history') ??
          formNavigation?.getAttribute('rmx-history') ??
          null,
        replaceHistoryByDefault,
      )

    let handler = async () => {
      let submission = await getSubmission?.()
      if (navigateEvent.signal.aborted) return
      await updatePage(destination, navigateEvent.signal, submission)
    }

    let replacement: NavigationReplacement | undefined
    if (replaceHistory) {
      replacement = getSubmission
        ? {
            type: 'form-submission',
            info: {
              type: formSubmissionNavigationInfoType,
              getSubmission,
            } satisfies FormSubmissionNavigationInfo,
          }
        : { type: 'navigation' }
    }

    interceptNavigation(navigateEvent, { handler, replacement })
  }

  async function updatePage(
    url: URL,
    navigationSignal: AbortSignal,
    submission: FormSubmission | undefined,
  ): Promise<void> {
    currentController?.abort()

    let controller = new AbortController()
    let signal = AbortSignal.any([handle.signal, navigationSignal, controller.signal])
    currentController = controller
    pending = url
    handle.update()

    try {
      let init: RequestInit = { signal }
      if (submission) {
        init.method = submission.method.toUpperCase()
        if (init.method !== 'GET' && init.method !== 'HEAD') {
          init.body = submission.formData
        }
      }

      let nextNode = await options.router.fetch(url, init)
      if (signal.aborted) return

      node = nextNode
      active = url
    } catch (error) {
      if (!signal.aborted) throw error
    } finally {
      if (currentController === controller) {
        currentController = undefined
        pending = undefined
        handle.update()
      }
    }
  }

  handle.queueTask(() => {
    resolveFormNavigation = createFormNavigationResolver(handle.signal)
    addEventListeners(window.navigation, handle.signal, { navigate: onNavigate })
    void updatePage(new URL(window.location.href), handle.signal, undefined)
  })

  return {
    get context() {
      return context
    },
    get node() {
      return node
    },
  }
}

function isFormSubmissionNavigationInfo(value: unknown): value is FormSubmissionNavigationInfo {
  return (
    typeof value === 'object' &&
    value != null &&
    'type' in value &&
    value.type === formSubmissionNavigationInfoType &&
    'getSubmission' in value &&
    typeof value.getSubmission === 'function'
  )
}
