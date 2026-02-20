import { createMixin, mixPlugin } from '@remix-run/reconciler'
import type { Plugin } from '@remix-run/reconciler'
import { basicPropsPlugin } from './plugins/basic-props-plugin.ts'
import { onPlugin } from './plugins/on-plugin.ts'
import { stylePropsPlugin } from './plugins/style-props-plugin.ts'
import { on } from './mixins/on-mixin.ts'

export function createDomPlugins() {
  let plugins: Plugin<any>[] = [
    mixPlugin,
    onPlugin,
    stylePropsPlugin,
    basicPropsPlugin,
  ]
  return plugins
}

export { basicPropsPlugin } from './plugins/basic-props-plugin.ts'
export { onPlugin } from './plugins/on-plugin.ts'
export { stylePropsPlugin } from './plugins/style-props-plugin.ts'
export { createMixin, mixPlugin, on }
