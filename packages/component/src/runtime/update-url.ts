import { appFrames, isRuntimeNavigation } from './navigation.ts'

interface PendingUrlUpdate {
  controller: AbortController
  state: unknown
}

const pendingUrlUpdates = new WeakMap<Window, PendingUrlUpdate>()

/**
 * Options for updating the current URL.
 */
export interface UpdateUrlOptions {
  /** How the URL updates browser history. (default: `"replace"`) */
  history?: 'replace' | 'push'
  /** Cancels a pending URL update without aborting the navigation it is waiting for. */
  signal?: AbortSignal
}

/**
 * Reflects locally rendered state in the URL without fetching, rendering, or changing scroll/focus.
 * Preserves history state and synchronizes Remix metadata and the top-frame source.
 * Waits for the active transition and requires the captured browser URL to remain current.
 * Supersession, navigation/URL changes, and cancellation resolve with an aborted signal.
 * Newer calls supersede waiting calls. Cancellation reasons are available on the returned signal.
 * Native interception of this update is unsupported (`NotSupportedError`); it may still commit.
 * Cross-origin URLs reject with `SecurityError`; other failures propagate.
 * Do not await this inside the captured transition's interception handler.
 *
 * @param href Same-origin URL, resolved against `document.baseURI` when applied. An empty string
 * retains the current URL.
 * @param options History mode (default: `"replace"`) and cancellation signal.
 * @returns The update's signal: aborted on cancellation, otherwise permanently non-aborted.
 */
export async function updateUrl(href: string, options?: UpdateUrlOptions): Promise<AbortSignal> {
  let signal = options?.signal
  if (signal?.aborted) return AbortSignal.abort(signal.reason)
  let previous = pendingUrlUpdates.get(window)
  let previousState = previous?.controller.signal.aborted ? undefined : previous?.state
  previous?.controller.abort(new DOMException('URL update was superseded', 'AbortError'))
  let update: PendingUrlUpdate = { controller: new AbortController(), state: undefined }
  pendingUrlUpdates.set(window, update)
  let { controller } = update
  let navigation = window.navigation
  let capturedUrl = window.location.href
  let capturedTransition = navigation?.transition
  let waitingSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal
  let dispatching = false
  let updateEvent: NavigateEvent | undefined
  function observeNavigation(event: NavigateEvent) {
    if (dispatching && !updateEvent) updateEvent = event
    else abortUrlUpdate(controller)
  }
  function updateHistory(): NavigateEvent | undefined {
    dispatching = true
    try {
      if (options?.history === 'push') window.history.pushState(window.history.state, '', href)
      else window.history.replaceState(window.history.state, '', href)
    } finally {
      dispatching = false
    }
    return updateEvent
  }
  try {
    navigation?.addEventListener('navigate', observeNavigation, {
      capture: true,
      signal: controller.signal,
    })
    if (capturedTransition) await waitForUrlUpdate(capturedTransition.finished, waitingSignal)
    waitingSignal.throwIfAborted()
    if (navigation?.transition || window.location.href !== capturedUrl)
      return abortUrlUpdate(controller)
    let entry = navigation?.currentEntry
    let state = entry?.getState()
    // A reentrant call can run after History API commit clears state, before we restore it.
    if (state === undefined && !capturedTransition) state = previousState
    update.state = state
    let destination = document.createElement('a')
    destination.href = href
    let destinationUrl = href === '' ? window.location.href : destination.href
    let event = updateHistory()
    controller.signal.throwIfAborted()
    if (event?.defaultPrevented || event?.signal.aborted) return abortUrlUpdate(controller)
    if (navigation?.transition) {
      throw new DOMException(
        'Native interception of URL updates is not supported',
        'NotSupportedError',
      )
    }
    let updatedEntry = navigation?.currentEntry
    if (entry && (updatedEntry?.id === entry.id || updatedEntry?.url !== destinationUrl)) {
      return abortUrlUpdate(controller)
    }
    let src = window.location.href
    if (navigation && state !== undefined) {
      navigation.updateCurrentEntry({
        state: isRuntimeNavigation(state) ? { ...state, target: undefined, src } : state,
      })
    }
    controller.signal.throwIfAborted()
    if (navigation?.currentEntry?.id !== updatedEntry?.id) return abortUrlUpdate(controller)
    if (appFrames) appFrames.top.src = src
    return controller.signal
  } catch (error) {
    if (
      (controller.signal.aborted && error === controller.signal.reason) ||
      (signal?.aborted && error === signal.reason)
    ) {
      return AbortSignal.abort(error)
    }
    throw error
  } finally {
    navigation?.removeEventListener('navigate', observeNavigation, { capture: true })
    if (pendingUrlUpdates.get(window) === update) pendingUrlUpdates.delete(window)
  }
}

function abortUrlUpdate(controller: AbortController): AbortSignal {
  controller.abort(
    new DOMException('Navigation or URL changed before update completed', 'AbortError'),
  )
  return controller.signal
}

async function waitForUrlUpdate(updating: Promise<void>, signal?: AbortSignal): Promise<void> {
  let listeners = new AbortController()
  try {
    await new Promise<void>((resolve, reject) => {
      if (signal?.aborted) {
        reject(signal.reason)
      } else {
        signal?.addEventListener('abort', () => reject(signal.reason), {
          once: true,
          signal: listeners.signal,
        })
      }
      void updating.then(resolve, reject)
    })
  } finally {
    listeners.abort()
  }
}
