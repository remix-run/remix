/** Context for a custom frame commit callback. */
export interface FrameCommitOptions {
  /** Resolved frame destination after redirects, or the requested source when not redirected. */
  to: string
  /** Original frame response, still unconsumed when the callback starts. */
  response: Response
  /** Aborts when this frame update is cancelled, superseded, or disposed. */
  signal: AbortSignal
}

/**
 * Wraps the rendering of a resolved frame response.
 *
 * Calling `commitFrame()` starts rendering once. Its promise waits for rendering and any enclosing
 * navigation, including followed redirects, scroll, and focus handling. Navigation does not wait
 * for the callback's post-commit work.
 *
 * Cancellation resolves without a stale render; rendering failures reject. Returning or throwing
 * without calling `commitFrame()` falls back to the default commit. Callback errors are reported
 * on the runtime.
 *
 * @param commitFrame Starts the default frame commit and waits for the completed update.
 * @param options Resolved destination, response, and cancellation context for this update.
 * @returns Optional asynchronous work surrounding the commit, such as an animation.
 */
export type FrameCommit = (
  commitFrame: () => Promise<void>,
  options: FrameCommitOptions,
) => void | Promise<void>

export interface FrameCommitNavigation {
  signal: AbortSignal
  finished: Promise<void>
  pendingCommits: number
}

const frameCommits = new WeakMap<Response, FrameCommit>()
const frameNavigations = new WeakMap<AbortSignal, FrameCommitNavigation>()

export function setFrameCommit(response: Response, commit: FrameCommit): void {
  frameCommits.set(response, commit)
}

export function takeFrameCommit(response: unknown): FrameCommit | undefined {
  if (!(response instanceof Response)) return
  let commit = frameCommits.get(response)
  frameCommits.delete(response)
  return commit
}

export function setFrameCommitNavigation(
  signal: AbortSignal,
  navigation: FrameCommitNavigation,
): void {
  frameNavigations.set(signal, navigation)
}

export function getFrameCommitNavigation(signal?: AbortSignal): FrameCommitNavigation | undefined {
  return signal ? frameNavigations.get(signal) : undefined
}

export async function commitFrameResponse(
  response: Response,
  commit: FrameCommit,
  render: () => Promise<void>,
  options: {
    to: string
    signal: AbortSignal
    commitSignal: AbortSignal
    onError(error: unknown): void
  },
): Promise<void> {
  let navigation = getFrameCommitNavigation(options.signal)
  let signal = AbortSignal.any([
    options.signal,
    options.commitSignal,
    ...(navigation ? [navigation.signal] : []),
  ])
  if (signal.aborted) return

  if (navigation) {
    navigation.pendingCommits++
  }
  let listeners = new AbortController()
  let aborted = new Promise<void>((resolve) => {
    signal.addEventListener('abort', () => resolve(), { once: true, signal: listeners.signal })
  })
  let started = Promise.withResolvers<void>()
  let rendered: Promise<void> | undefined
  let completed: Promise<void> | undefined
  let renderFailure: { error: unknown } | undefined

  function commitFrame(): Promise<void> {
    if (!rendered) {
      rendered = Promise.resolve()
        .then(() => {
          if (!signal.aborted) return render()
        })
        .catch((error) => {
          renderFailure = { error }
          throw error
        })
      completed = Promise.race([rendered.then(() => navigation?.finished), aborted])
      // A callback can start the commit without awaiting its result.
      void completed.catch(() => {})
      started.resolve()
    }
    return completed ?? Promise.resolve()
  }

  let callback = Promise.resolve()
    .then(() => {
      if (!signal.aborted) return commit(commitFrame, { to: options.to, response, signal })
    })
    .catch((error) => {
      if (!signal.aborted && (!renderFailure || renderFailure.error !== error)) {
        options.onError(error)
      }
    })

  // The wrapper can wait for navigation or animation completion after the renderer is released.
  await Promise.race([started.promise, callback, aborted])
  void commitFrame()
  void Promise.allSettled([Promise.race([callback, aborted]), completed]).then(() => {
    listeners.abort()
    if (navigation) navigation.pendingCommits--
  })
  await Promise.race([rendered, aborted])
}
