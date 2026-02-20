import { createReconciler } from '@remix-run/reconciler'
import type { Plugin } from '@remix-run/reconciler'
import { createOpenTuiHostBridge } from './tui-host.ts'
import { createTuiNodePolicy, createTuiContainer } from './tui-node-policy.ts'
import type {
  TuiContainerNode,
  TuiElementNode,
} from './tui-node-policy.ts'
import { createTuiPlugins } from './tui-plugins.ts'

export type CreateTuiReconcilerOptions = {
  plugins?: Plugin<TuiElementNode>[]
}

export function createTuiReconciler(options: CreateTuiReconcilerOptions = {}) {
  let plugins = options.plugins ?? createTuiPlugins()
  return createReconciler({
    policy: createTuiNodePolicy(),
    plugins,
  })
}

export async function createOpenTuiRoot(options: Record<string, unknown> = {}) {
  let { renderer, bridge } = await createOpenTuiHostBridge(options)
  let container = createTuiContainer(renderer, bridge)
  let reconciler = createTuiReconciler()
  let root = reconciler.createRoot(container)
  return {
    renderer,
    container,
    root,
    dispose() {
      root.dispose()
      bridge.dispose?.()
    },
  }
}

export type {
  TuiContainerNode,
  TuiElementNode,
  TuiNode,
  TuiParentNode,
  TuiTextNode,
}
