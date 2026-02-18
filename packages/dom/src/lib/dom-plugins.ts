import type { Plugin } from '@remix-run/reconciler'
import { basicPropsPlugin } from './plugins/basic-props-plugin.ts'
import { onPlugin } from './plugins/on-plugin.ts'
import { stylePropsPlugin } from './plugins/style-props-plugin.ts'
import type {
  DomElementNode,
  DomNode,
  DomParentNode,
  DomTextNode,
} from './dom-node-policy.ts'

export function createDomPlugins() {
  let plugins: Plugin<DomParentNode, DomNode, DomTextNode, DomElementNode>[] = [
    onPlugin,
    stylePropsPlugin,
    basicPropsPlugin,
  ]
  return plugins
}

export { basicPropsPlugin, onPlugin, stylePropsPlugin }
