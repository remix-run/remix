import { createFrame, type Frame } from './frame.ts'
import { createScheduler } from './vdom.ts'
import { createStyleManager } from '../style/index.ts'
import type { FrameHandle, Handle } from './component.ts'
import { createComponentErrorEvent } from './error-event.ts'
import type { ComponentErrorEvent } from './error-event.ts'
import type { LoadModule, ResolveFrame, ResolveFrameOptions } from './frame.ts'
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
   * Defaults to fetching the frame source as HTML with the submitted form data,
   * method, encoding, and abort signal.
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

// Frame reloads can receive raw FormData without going through form navigation. Encode it here so
// manual reloads use the requested form encoding instead of always sending multipart bodies.
function getRequestBody(options?: ResolveFrameOptions): BodyInit | undefined {
  let formData = options?.formData
  let method = options?.method
  if (!formData || !method || ['get', 'head'].includes(method.toLowerCase())) return

  let encType = options?.encType

  if (encType === 'text/plain') {
    let body = ''
    for (let [name, value] of formData) {
      name = normalizeLineBreaks(name)
      value = normalizeLineBreaks(typeof value === 'string' ? value : value.name)
      body += `${name}=${value}\r\n`
    }
    return new Blob([body], { type: 'text/plain' })
  }

  if (encType !== 'application/x-www-form-urlencoded') return formData

  let body = new URLSearchParams()
  for (let [name, value] of formData) {
    body.append(name, typeof value === 'string' ? value : value.name)
  }
  return body
}

function normalizeLineBreaks(value: string): string {
  return value.replace(/\r\n|\r|\n/g, '\r\n')
}

async function defaultResolveFrame(src: string, options?: ResolveFrameOptions): Promise<Response> {
  let response = await fetch(src, {
    body: getRequestBody(options),
    headers: { Accept: 'text/html' },
    method: options?.method,
    signal: options?.signal,
  })

  if (!response.ok) {
    throw new Error(`Failed to resolve frame: ${response.status} ${response.statusText}`.trimEnd())
  }

  return response
}

/**
 * Starts the client-side Remix component runtime for the current document.
 *
 * @param init Runtime options for loading modules and customizing frame resolution.
 * @returns The running application runtime.
 */
export function run(init: RunInit): AppRuntime {
  let styleManager = createStyleManager()
  let errorTarget = new TypedEventTarget<AppRuntimeEventMap>()
  let scheduler = createScheduler(document, errorTarget, styleManager)

  let resolveFrame = init.resolveFrame ?? defaultResolveFrame

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
      styleManager.dispose()
    },
  })
}
