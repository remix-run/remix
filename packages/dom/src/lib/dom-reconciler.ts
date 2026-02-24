import { createReconciler } from '@remix-run/reconciler'
import type { ComponentHandle, PluginDefinition } from '@remix-run/reconciler'
import { createDomNodePolicy } from './dom-node-policy.ts'
import { createDomPlugins } from './dom-plugins.ts'

export type DomReconcilerOptions = {
  plugins?: PluginDefinition<any>[]
  extendComponentHandle?: (handle: ComponentHandle) => void | Partial<ComponentHandle>
}

export function createDomReconciler(
  document: Document,
  options: PluginDefinition<any>[] | DomReconcilerOptions = {},
) {
  let resolved: DomReconcilerOptions = Array.isArray(options) ? { plugins: options } : options
  let plugins = resolved.plugins ?? createDomPlugins(document)
  return createReconciler({
    policy: createDomNodePolicy(document),
    plugins,
    extendComponentHandle: resolved.extendComponentHandle,
  })
}
