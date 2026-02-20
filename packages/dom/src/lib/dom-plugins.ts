import { createMixin, mixPlugin } from '@remix-run/reconciler'
import type { PluginDefinition } from '@remix-run/reconciler'
import { basicPropsPlugin } from './plugins/basic-props-plugin.ts'
import { createDocumentStatePlugin } from './plugins/document-state-plugin.ts'
import { stylePropsPlugin } from './plugins/style-props-plugin.ts'
import { css } from './mixins/css-mixin.ts'
import { on } from './mixins/on-mixin.ts'

export function createDomPlugins(document: Document) {
  let plugins: PluginDefinition<any>[] = [
    createDocumentStatePlugin(document),
    mixPlugin,
    stylePropsPlugin,
    basicPropsPlugin,
  ]
  return plugins
}

export { basicPropsPlugin } from './plugins/basic-props-plugin.ts'
export { createDocumentStatePlugin, getDocumentState } from './plugins/document-state-plugin.ts'
export { stylePropsPlugin } from './plugins/style-props-plugin.ts'
export { createMixin, css, mixPlugin, on }
