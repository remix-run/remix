import { createReconciler } from '@remix-run/reconciler'
import { mixPlugin } from '@remix-run/reconciler'
import type { ComponentHandle, PluginDefinition } from '@remix-run/reconciler'
import { createDomNodePolicy } from './dom-node-policy.ts'
import { attributePropsPlugin } from './plugins/attribute-props-plugin.ts'
import { basicPropsPlugin } from './plugins/basic-props-plugin.ts'
import { createDocumentStatePlugin } from './plugins/document-state-plugin.ts'
import { stylePropsPlugin } from './plugins/style-props-plugin.ts'

export type DomReconcilerOptions = {
  plugins?: PluginDefinition<any>[]
  extendComponentHandle?: (handle: ComponentHandle) => void | Partial<ComponentHandle>
}

export function createDomReconciler(
  document: Document,
  options: PluginDefinition<any>[] | DomReconcilerOptions = {},
) {
  let resolved: DomReconcilerOptions = Array.isArray(options) ? { plugins: options } : options
  let plugins = resolved.plugins ?? [
    createDocumentStatePlugin(document),
    mixPlugin,
    attributePropsPlugin,
    stylePropsPlugin,
    basicPropsPlugin,
  ]
  return createReconciler({
    policy: createDomNodePolicy(document),
    plugins,
    extendComponentHandle: resolved.extendComponentHandle,
  })
}
