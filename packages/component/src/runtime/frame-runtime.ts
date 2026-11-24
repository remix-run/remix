import type { FrameHandle, FrameResolution, ReloadOrigin } from './component.ts'
import type { RemixElement, RemixNode } from './core/vnode.ts'
import type { ElementFunction } from './element-function.ts'
import type { FrameInstance } from './frame.ts'
import type { ProcessClientEntryPreloads } from './frame.ts'
import type { StyleManager } from '../style/stylesheet.ts'
import type { ResourceNonces } from './nonce.ts'
import type { Scheduler, VirtualRoot } from './vdom.ts'

// Unlike `from`, this marker must not propagate to nested frame loads.
export const navigationRequest = Symbol('navigationRequest')

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
  /**
   * Effective history behavior of the navigation that caused this load.
   * Inherited by client frames within its response; absent for independent loads and reloads.
   */
  navigationType?: NavigationType
  /**
   * Original history entry being left, inherited by client frames within the response.
   * Absent for independent loads and reloads. Redirects preserve the original entry.
   */
  from?: NavigationHistoryEntry
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

type PendingClientEntries = Map<Comment, [Comment, RemixElement | undefined, ResourceNonces?]>

export type FrameNavigationOptions = Omit<ResolveFrameOptions, 'target'> & {
  [navigationRequest]?: true
  /** The initiating anchor, area, or owning form. */
  element?: HTMLAnchorElement | HTMLAreaElement | SVGAElement | HTMLFormElement
  /** The actual submitter captured by the native submit event. */
  submitter?: HTMLElement | null
  /** The owning form for a submission, even when its submitter has been detached. */
  form?: HTMLFormElement
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
  // Only client-inserted frames own a fallback root, until replacement content starts rendering.
  fallbackRoot?: FrameFallbackRoot
}

export class FrameRegistry {
  entries: PendingClientEntries = new Map()
  modules = new Map<string, ElementFunction | Promise<ElementFunction | undefined>>()
  instances = new WeakMap<Comment, FrameInstance>()

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

export type SharedFrameRuntime = {
  errorTarget: EventTarget
  loadModule: LoadModule
  resolveFrame: ResolveFrame
  scheduler: Scheduler
  styleManager: StyleManager
  registry: FrameRegistry
  processClientEntryPreloads?: ProcessClientEntryPreloads
}

export type FrameRuntime = SharedFrameRuntime & {
  [FRAME_RUNTIME]: true
  getContext?: (type: ElementFunction) => unknown
  topFrame?: FrameHandle
  serverFrameReload:
    | {
        signal: AbortSignal
        origin?: ReloadOrigin
        navigationType?: NavigationType
        from?: NavigationHistoryEntry
        reconciliationTracker?: ReconciliationTracker
        blockingFrameTracker?: ReconciliationTracker
      }
    | undefined
  reloadForNavigation?: (options?: FrameNavigationOptions) => FrameReloadTransition
}

export function getSharedFrameRuntime(source: SharedFrameRuntime): SharedFrameRuntime {
  return {
    errorTarget: source.errorTarget,
    loadModule: source.loadModule,
    resolveFrame: source.resolveFrame,
    scheduler: source.scheduler,
    styleManager: source.styleManager,
    registry: source.registry,
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

export function createFrameRuntime(
  init: SharedFrameRuntime & Pick<FrameRuntime, 'topFrame' | 'getContext' | 'reloadForNavigation'>,
): FrameRuntime {
  return {
    [FRAME_RUNTIME]: true,
    topFrame: init.topFrame,
    getContext: init.getContext,
    ...getSharedFrameRuntime(init),
    serverFrameReload: undefined,
    reloadForNavigation: init.reloadForNavigation,
  }
}

export type ClientEntryIdentity = {
  moduleUrl: string
  exportName: string
}

type ClientEntryRoot = Pick<VirtualRoot, 'dispose' | 'render'>

export type ClientEntryBoundaryOwner = {
  end: Comment
  identity: ClientEntryIdentity
  root: ClientEntryRoot
}

const CLIENT_ENTRY_BOUNDARY_OWNER = Symbol('ClientEntryBoundaryOwner')

type ClientEntryBoundaryMarker = Comment & {
  [CLIENT_ENTRY_BOUNDARY_OWNER]?: ClientEntryBoundaryOwner
  $rmx?: ClientEntryRoot
}

export function getClientEntryBoundaryOwner(marker: Comment): ClientEntryBoundaryOwner | undefined {
  return (marker as ClientEntryBoundaryMarker)[CLIENT_ENTRY_BOUNDARY_OWNER]
}

export function setClientEntryBoundaryOwner(
  marker: Comment,
  end: Comment,
  identity: ClientEntryIdentity,
  root: ClientEntryRoot,
): ClientEntryBoundaryOwner {
  let owner = { end, identity, root }
  Object.defineProperties(marker, {
    [CLIENT_ENTRY_BOUNDARY_OWNER]: {
      configurable: true,
      value: owner,
    },
    $rmx: {
      configurable: true,
      value: root,
    },
  })
  return owner
}

export function disposeClientEntryBoundary(marker: Comment): boolean {
  let boundaryMarker = marker as ClientEntryBoundaryMarker
  let owner = boundaryMarker[CLIENT_ENTRY_BOUNDARY_OWNER]
  if (!owner) return false

  delete boundaryMarker[CLIENT_ENTRY_BOUNDARY_OWNER]
  delete boundaryMarker.$rmx
  owner.root.dispose()
  return true
}

export const pendingPrefetchLinks = new WeakSet<Node>()

type SPAResponseData = {
  node: RemixNode
  redirectedTo?: string
}

export const spaResponses = new WeakMap<Response, SPAResponseData>()
