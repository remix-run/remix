import { createMixin, mixPlugin } from '@remix-run/reconciler'
import type { PluginDefinition } from '@remix-run/reconciler'
import { basicPropsPlugin } from './plugins/basic-props-plugin.ts'
import { attributePropsPlugin } from './plugins/attribute-props-plugin.ts'
import { createDocumentStatePlugin } from './plugins/document-state-plugin.ts'
import { stylePropsPlugin } from './plugins/style-props-plugin.ts'
import { animateLayout } from './mixins/animate-layout-mixin.tsx'
import { animateEntrance, animateExit } from './mixins/animate-presence.tsx'
import { css } from './mixins/css-mixin.tsx'
import { on } from './mixins/on-mixin.tsx'
import { spring } from './spring.ts'

export function createDomPlugins(document: Document) {
  let plugins: PluginDefinition<any>[] = [
    createDocumentStatePlugin(document),
    mixPlugin,
    attributePropsPlugin,
    stylePropsPlugin,
    basicPropsPlugin,
  ]
  return plugins
}

export { basicPropsPlugin } from './plugins/basic-props-plugin.ts'
export { attributePropsPlugin } from './plugins/attribute-props-plugin.ts'
export { createDocumentStatePlugin, getDocumentState } from './plugins/document-state-plugin.ts'
export { stylePropsPlugin } from './plugins/style-props-plugin.ts'
export { animateEntrance, animateExit, animateLayout, createMixin, css, mixPlugin, on, spring }
