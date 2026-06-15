import { createFrame, type Frame } from './frame.ts'
import { createScheduler } from './vdom.ts'
import { createStyleManager } from '../style/index.ts'
import type { FrameHandle, Handle } from './component.ts'
import { createComponentErrorEvent } from './error-event.ts'
import type { ComponentErrorEvent } from './error-event.ts'
import type { LoadModule, ResolveFrame } from './frame.ts'
import { startNavigationListener } from './navigation.ts'
import { TypedEventTarget } from './typed-event-target.ts'

/**
 * Options for starting the client runtime with {@link run}.
 */
export interface RunInit {
  /**
   * Loads the named browser module export for a hydrated `clientEntry()`.
   *
   * Implementations usually call dynamic `import(moduleUrl)` and return
   * `mod[exportName]`.
   */
  loadModule: LoadModule

  /**
   * Resolves browser-loaded `<Frame>` content.
   *
   * Omit this only when the runtime never needs to load or reload frames in the
   * browser.
   */
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
  /** Access top-level and named frames in the application runtime. */
  frames: Handle['frames']
  /** Resolves after the current document finishes hydrating. */
  ready(): Promise<void>
  /** Flushes any queued component updates synchronously. */
  flush(): void
  /** Stops runtime listeners and disposes the top-level frame. */
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
  let styleManager = createStyleManager()
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
  let frames: Handle['frames'] = {
    top: topFrame.handle,
    get(name) {
      return namedFrames.get(name)
    },
  }
  startNavigationListener(appController.signal)
  let readyPromise = topFrame.ready().catch((error) => {
    errorTarget.dispatchEvent(createComponentErrorEvent(error))
    throw error
  })

  return Object.assign(errorTarget, {
    frames,
    ready: () => readyPromise,
    flush: () => topFrame.flush(),
    dispose: () => {
      appController.abort()
      topFrame.dispose()
    },
  })
}
