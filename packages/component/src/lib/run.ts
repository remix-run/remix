import { createFrame } from './frame.ts'
import { createScheduler } from './vdom.ts'
import { defaultStyleManager } from './diff-props.ts'
import type { FrameContent } from './component.ts'
import type { Props } from './jsx.ts'

type HydrationScript = { src: string } & Omit<Props<'script'>, 'children' | 'src' | 'type'>

type LoadModule = (
  moduleUrl: HydrationScript,
  exportName: string,
  chunks: HydrationScript[],
) => Promise<Function> | Function
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

export function run(doc: Document, init: RunInit): AppRuntime {
  let styleManager = defaultStyleManager
  let errorTarget = new EventTarget()
  let scheduler = createScheduler(doc, errorTarget, styleManager)

  let resolveFrame: ResolveFrame = init.resolveFrame ?? (() => '<p>resolve frame unimplemented</p>')

  let frame = createFrame(doc, {
    src: doc.location?.href ?? '/',
    loadModule: init.loadModule,
    resolveFrame,
    pendingClientEntries: new Map(),
    scheduler,
    styleManager,
    data: {},
    moduleCache: new Map(),
    moduleLoads: new Map(),
    frameInstances: new WeakMap(),
    namedFrames: new Map(),
  })

  return Object.assign(errorTarget, {
    ready: () => frame.ready(),
    flush: () => frame.flush(),
    dispose: () => frame.dispose(),
  })
}
