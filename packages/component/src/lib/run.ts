import { createFrame, type Frame } from './frame.ts'
import { createScheduler } from './vdom.ts'
import { defaultStyleManager } from './diff-props.ts'
import type { FrameHandle } from './component.ts'
import { createComponentErrorEvent } from './error-event.ts'
import type { ComponentErrorEvent } from './error-event.ts'
import type { LoadModule, ResolveFrame } from './frame.ts'
import { startNavigationListener } from './navigation.ts'
import { TypedEventTarget } from './typed-event-target.ts'

/**
 * Options for starting the client runtime with {@link run}.
 */
export type RunInit = {
  loadModule: LoadModule
  resolveFrame?: ResolveFrame
}

/**
 * Events emitted by the application runtime.
 */
export type AppRuntimeEventMap = {
  error: ComponentErrorEvent
}

/**
 * Client runtime returned by {@link run}.
 */
export type AppRuntime = TypedEventTarget<AppRuntimeEventMap> & {
  ready(): Promise<void>
  flush(): void
  dispose(): void
}

let topFrame: Frame
/**
 * Returns the top-level frame handle for the running application.
 *
 * @returns The top-level frame handle.
 */
export function getTopFrame(): FrameHandle {
  if (!topFrame) throw new Error('app runtime not initialized')
  return topFrame.handle
}

const namedFrames = new Map<string, FrameHandle>()
/**
 * Returns a named frame handle, falling back to the top frame when not found.
 *
 * @param name Name of the frame to look up.
 * @returns The matching frame handle or the top frame.
 */
export function getNamedFrame(name: string): FrameHandle {
  return namedFrames.get(name) ?? getTopFrame()
}

/**
 * Starts the client-side Remix component runtime for the current document.
 *
 * @param init Runtime hooks for loading modules and resolving frames.
 * @returns The running application runtime.
 */
export function run(init: RunInit): AppRuntime {
  let styleManager = defaultStyleManager
  let errorTarget = new TypedEventTarget<AppRuntimeEventMap>()
  let scheduler = createScheduler(document, errorTarget, styleManager)

  let resolveFrame: ResolveFrame = init.resolveFrame ?? (() => '<p>resolve frame unimplemented</p>')

  topFrame = createFrame(document, {
    src: document.location.href,
    errorTarget,
    loadModule: init.loadModule,
    resolveFrame,
    pendingClientEntries: new Map(),
    scheduler,
    styleManager,
    data: {},
    moduleCache: new Map(),
    moduleLoads: new Map(),
    frameInstances: new WeakMap(),
    namedFrames,
  })

  let appController = new AbortController()
  startNavigationListener(appController.signal)
  let readyPromise = topFrame.ready().catch((error) => {
    errorTarget.dispatchEvent(createComponentErrorEvent(error))
    throw error
  })

  return Object.assign(errorTarget, {
    ready: () => readyPromise,
    flush: () => topFrame.flush(),
    dispose: () => {
      appController.abort()
      topFrame.dispose()
    },
  })
}
