import { createReconciler } from '@remix-run/reconciler'
import type { Plugin } from '@remix-run/reconciler'
import { createDomNodePolicy } from './dom-node-policy.ts'
import { createDomPlugins } from './dom-plugins.ts'

export function createDomReconciler(
  document: Document,
  plugins: Plugin<any>[] = createDomPlugins(),
) {
  return createReconciler({
    policy: createDomNodePolicy(document),
    plugins,
  })
}
