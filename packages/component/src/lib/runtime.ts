import { defaultStyleManager } from './diff-props.ts'
import type { StyleManager } from './style/index.ts'
import type { CommittedHostNode } from './vnode.ts'

export type DomRange = {
  first: Node | null
  last: Node | null
}

export type RendererRuntime = {
  document: Document
  styleManager: StyleManager
  componentIdCounter: number
  persistedRemovalToken: number
  persistedMixinNodes: Set<CommittedHostNode>
}

export function createRendererRuntime(
  doc: Document,
  styleManager: StyleManager = defaultStyleManager,
): RendererRuntime {
  return {
    document: doc,
    styleManager,
    componentIdCounter: 0,
    persistedRemovalToken: 0,
    persistedMixinNodes: new Set(),
  }
}

export function nextComponentId(runtime: RendererRuntime): string {
  runtime.componentIdCounter++
  return `c${runtime.componentIdCounter}`
}

export function nextPersistedRemovalToken(runtime: RendererRuntime): number {
  runtime.persistedRemovalToken++
  return runtime.persistedRemovalToken
}
