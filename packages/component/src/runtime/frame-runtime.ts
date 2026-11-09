import type { FrameHandle, FrameResolution } from './component.ts'
import type { RemixElement, RemixNode } from './core/vnode.ts'
import type { ElementFunction } from './element-function.ts'
import type { FrameInstance } from './frame.ts'
import type { ProcessClientEntryPreloads } from './module-preloader.ts'
import type { Scheduler } from './scheduler.ts'
import type { StyleManager } from '../style/index.ts'
import type { ResourceNonces } from './nonce.ts'

/**
 * Loads a named client-entry export for hydration.
 *
 * Module specifiers from trusted document metadata are passed through unchanged. The loader
 * controls resolution, including import maps, CDN URLs, and development server URLs.
 *
 * @param moduleUrl Module specifier for the client entry, as serialized by the server.
 * @param exportName Named export to read from the loaded module.
 * @returns The exported component function, or a promise for it.
 *
 * @example
 * ```ts
 * run({
 *   async loadModule(moduleUrl, exportName) {
 *     let mod = await import(moduleUrl)
 *     return mod[exportName]
 *   },
 * })
 * ```
 */
export type LoadModule = (moduleUrl: string, exportName: string) => Promise<Function> | Function

/**
 * Resolves content for a browser-loaded frame.
 *
 * Only return trusted application content. Remix does not sanitize HTML strings, streams, or
 * response bodies before parsing and reconciling them into the current document. Frame HTML can
 * select client-entry modules and contribute import maps, styles, and nested frames.
 *
 * @param src Frame source or destination URL for a top-frame navigation.
 * @param options Information about the active frame load or form submission.
 * @returns Frame content or a response whose body should be rendered into the frame.
 */
export type ResolveFrame = (
  src: string,
  options?: ResolveFrameOptions,
) => Promise<FrameResolution> | FrameResolution

/**
 * Information available while resolving browser-loaded frame content.
 */
export interface ResolveFrameOptions {
  /** Frame name, absent for both the top-level document and unnamed `<Frame>` loads. */
  target?: string
  /** Form values submitted to the frame source for a POST reload or navigation. */
  formData?: FormData
  /** HTTP method selected by the reload options or the form and its submitter. */
  method?: string
  /** Body encoding selected by the reload options or the form and its submitter. */
  encType?: string
  /** Cancels the active frame request. Custom resolvers should forward this to `fetch()`. */
  signal?: AbortSignal
}

/**
 * Wraps the swap of a top-frame navigation, for example in `document.startViewTransition()`.
 *
 * Remix calls it after the destination's response is in hand and before the current page is
 * replaced, so the old page stays interactive while a slow response loads. The swap starts when the
 * function calls `commit()`, or when it returns or throws without calling it. Remix reports a
 * thrown error as a component error and still swaps. Navigations started with
 * `window.location`, `popstate`, POST form submissions and named frames do not call it.
 *
 * @param options The navigation, its destination, and the means to swap it in.
 * @returns A promise Remix does not wait for once the swap has started.
 *
 * @example
 * ```ts
 * run({
 *   async frameTransition({ signal, commit }) {
 *     if (!document.startViewTransition || signal.aborted) return commit()
 *     let transition = document.startViewTransition(() => commit())
 *     signal.addEventListener('abort', () => transition.skipTransition(), { once: true })
 *     await transition.finished.catch(() => {})
 *   },
 * })
 * ```
 */
export type FrameTransition = (options: FrameTransitionOptions) => Promise<void> | void

/**
 * Describes the top-frame navigation passed to a {@link FrameTransition}.
 */
export interface FrameTransitionOptions {
  /**
   * The browser's Navigation API transition. `from` is the entry being left, and
   * `navigationType` is `push`, `replace`, `reload` or `traverse`. A traversal has already
   * committed its destination, so compare `from.index` with `navigation.currentEntry.index` to
   * tell Back from Forward. A navigation that interrupts one whose page never rendered leaves
   * that navigation's entry, so `from` is not the page on screen.
   */
  transition: NavigationTransition
  /** The destination URL after redirects, which `navigation.currentEntry` may not reflect yet. */
  to: string
  /** Aborts when the navigation is cancelled or superseded. */
  signal: AbortSignal
  /**
   * Swaps the destination in. Resolves when the navigation has finished, including scroll and
   * focus restoration, or has been cancelled or superseded, so it can be the update callback of a
   * view transition that captures the finished page. Calling it again, or after the navigation was
   * cancelled or superseded, does not swap again.
   */
  commit(): Promise<void>
}

export type PendingClientEntries = Map<
  Comment,
  [Comment, RemixElement | undefined, ResourceNonces?]
>

export type FrameNavigationOptions = Omit<ResolveFrameOptions, 'target'> & {
  /** Set for top-frame navigations that the app's `frameTransition` may wrap. */
  transition?: NavigationTransition
}

export type FrameReloadResult = {
  signal: AbortSignal
  redirectedTo?: string
}

export type FrameReloadTransition = {
  signal: AbortSignal
  committed: Promise<void>
  finished: Promise<FrameReloadResult>
}

export type ReconciliationTracker = {
  track: () => () => void
  waitFor: (task: Promise<void>) => void
  finalize: () => void
  ready: () => Promise<void>
}

export interface FrameFallbackRoot {
  render(element: RemixNode): void
  dispose(): void
}

export type FrameMountState = {
  instance: FrameInstance
  fallbackRoot?: FrameFallbackRoot
  resolveToken: number
  resolveController?: AbortController
  resolved: boolean
}

export class NamedFrameRegistry {
  #framesByName = new Map<string, FrameHandle[]>()

  register(name: string, frame: FrameHandle): void {
    let frames = this.#framesByName.get(name)
    if (frames) {
      frames.push(frame)
    } else {
      this.#framesByName.set(name, [frame])
    }
  }

  get(name: string): FrameHandle | undefined {
    return this.#framesByName.get(name)?.at(-1)
  }

  unregister(name: string, frame: FrameHandle): void {
    let frames = this.#framesByName.get(name)
    if (!frames) return

    let index = frames.lastIndexOf(frame)
    if (index === -1) return
    frames.splice(index, 1)

    if (frames.length === 0) {
      this.#framesByName.delete(name)
    }
  }
}

const FRAME_RUNTIME = Symbol('FrameRuntime')

export type FrameRuntime = {
  [FRAME_RUNTIME]: true
  canResolveFrames?: boolean
  getContext?: (type: ElementFunction) => unknown
  topFrame?: FrameHandle
  errorTarget: EventTarget
  loadModule: LoadModule
  resolveFrame: ResolveFrame
  pendingClientEntries: PendingClientEntries
  scheduler: Scheduler
  styleManager: StyleManager
  moduleCache: Map<string, ElementFunction>
  moduleLoads: Map<string, Promise<ElementFunction | undefined>>
  frameInstances: WeakMap<Comment, FrameInstance>
  namedFrames: NamedFrameRegistry
  processClientEntryPreloads?: ProcessClientEntryPreloads
  serverFrameReload:
    | {
        signal: AbortSignal
        reconciliationTracker?: ReconciliationTracker
        blockingFrameTracker?: ReconciliationTracker
      }
    | undefined
  reloadForNavigation?: (options?: FrameNavigationOptions) => FrameReloadTransition
}

export type SharedFrameRuntime = Pick<
  FrameRuntime,
  | 'errorTarget'
  | 'loadModule'
  | 'resolveFrame'
  | 'pendingClientEntries'
  | 'scheduler'
  | 'styleManager'
  | 'moduleCache'
  | 'moduleLoads'
  | 'frameInstances'
  | 'namedFrames'
  | 'processClientEntryPreloads'
>

export function getSharedFrameRuntime(source: SharedFrameRuntime): SharedFrameRuntime {
  return {
    errorTarget: source.errorTarget,
    loadModule: source.loadModule,
    resolveFrame: source.resolveFrame,
    pendingClientEntries: source.pendingClientEntries,
    scheduler: source.scheduler,
    styleManager: source.styleManager,
    moduleCache: source.moduleCache,
    moduleLoads: source.moduleLoads,
    frameInstances: source.frameInstances,
    namedFrames: source.namedFrames,
    processClientEntryPreloads: source.processClientEntryPreloads,
  }
}

export function isFrameRuntime(value: unknown): value is FrameRuntime {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Reflect.get(value, FRAME_RUNTIME) === true
  )
}

export function getFrameRuntime(frame: FrameHandle): FrameRuntime | undefined {
  let runtime = frame.$runtime
  return isFrameRuntime(runtime) ? runtime : undefined
}

export function createFrameRuntime(init: {
  topFrame?: FrameHandle
  getContext?: (type: ElementFunction) => unknown
  errorTarget: EventTarget
  loadModule: LoadModule
  resolveFrame: ResolveFrame
  pendingClientEntries: PendingClientEntries
  scheduler: Scheduler
  styleManager: StyleManager
  moduleCache: Map<string, ElementFunction>
  moduleLoads: Map<string, Promise<ElementFunction | undefined>>
  frameInstances: WeakMap<Comment, FrameInstance>
  namedFrames: NamedFrameRegistry
  processClientEntryPreloads?: ProcessClientEntryPreloads
  reloadForNavigation?: (options?: FrameNavigationOptions) => FrameReloadTransition
}): FrameRuntime {
  return {
    [FRAME_RUNTIME]: true,
    topFrame: init.topFrame,
    getContext: init.getContext,
    ...getSharedFrameRuntime(init),
    serverFrameReload: undefined,
    reloadForNavigation: init.reloadForNavigation,
  }
}
