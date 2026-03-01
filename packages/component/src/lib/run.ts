import { createFrame, type Frame } from './frame.ts'
import { createScheduler } from './vdom.ts'
import { defaultStyleManager } from './diff-props.ts'
import type { FrameContent, FrameHandle } from './component.ts'
import { startNavigationListener } from './navigate.ts'

type LoadModule = (moduleUrl: string, exportName: string) => Promise<Function> | Function
type ResolveFrame = (src: string, signal?: AbortSignal) => Promise<FrameContent> | FrameContent

export type RunInit = {
  loadModule: LoadModule
  resolveFrame?: ResolveFrame
}

export type AppRuntime = EventTarget & {
  ready(): Promise<void>
  flush(): void
  dispose(): void
}

let topFrame: Frame
export function getTopFrame(): FrameHandle {
  if (!topFrame) throw new Error('app runtime not initialized')
  return topFrame.handle
}

let namedFrames = new Map<string, FrameHandle>()
export function getNamedFrame(name: string): FrameHandle {
  return namedFrames.get(name) ?? getTopFrame()
}

export function run(init: RunInit): AppRuntime {
  let styleManager = defaultStyleManager
  let errorTarget = new EventTarget()
  let scheduler = createScheduler(document, errorTarget, styleManager)

  let resolveFrame: ResolveFrame = init.resolveFrame ?? (() => '<p>resolve frame unimplemented</p>')

  topFrame = createFrame(document, {
    src: document.location.href,
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

  return Object.assign(errorTarget, {
    ready: () => topFrame.ready(),
    flush: () => topFrame.flush(),
    dispose: () => {
      appController.abort()
      topFrame.dispose()
    },
  })
}
