import type { Plugin } from '@remix-run/reconciler'
import { basicPropsPlugin } from './plugins/basic-props-plugin.ts'
import { inputEventPlugin } from './plugins/input-event-plugin.ts'
import { layoutPlugin } from './plugins/layout-plugin.ts'
import { stylePlugin } from './plugins/style-plugin.ts'
import type {
  TuiElementNode,
  TuiNode,
  TuiParentNode,
  TuiTextNode,
} from './tui-node-policy.ts'

export function createTuiPlugins() {
  let plugins: Plugin<TuiParentNode, TuiNode, TuiTextNode, TuiElementNode>[] = [
    stylePlugin,
    layoutPlugin,
    inputEventPlugin,
    basicPropsPlugin,
  ]
  return plugins
}

export { basicPropsPlugin, inputEventPlugin, layoutPlugin, stylePlugin }
