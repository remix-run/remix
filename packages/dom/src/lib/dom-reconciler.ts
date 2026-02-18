import { createReconciler } from '@remix-run/reconciler'
import type { Plugin } from '@remix-run/reconciler'
import { createDomNodePolicy } from './dom-node-policy.ts'
import { createDomPlugins } from './dom-plugins.ts'
import type {
  DomElementNode,
  DomNode,
  DomParentNode,
  DomTextNode,
} from './dom-node-policy.ts'

export function createDomReconciler(
  document: Document,
  plugins: Plugin<DomParentNode, DomNode, DomTextNode, DomElementNode>[] = createDomPlugins(),
) {
  return createReconciler({
    policy: createDomNodePolicy(document),
    plugins,
  })
}
