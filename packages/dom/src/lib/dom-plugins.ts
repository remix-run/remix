import type { Plugin } from '@remix-run/reconciler'

import { ariaDataAttributePlugin } from './plugins/aria-data-attribute-plugin.ts'
import { attributeFallbackPlugin } from './plugins/attribute-fallback-plugin.ts'
import { connectPlugin } from './plugins/connect-plugin.ts'
import { domPropertyOrAttributePlugin } from './plugins/dom-property-or-attribute-plugin.ts'
import { formStatePlugin } from './plugins/form-state-plugin.ts'
import { innerHTMLPlugin } from './plugins/inner-html-plugin.ts'
import { onPlugin } from './plugins/on-plugin.ts'
import { restPropsPlugin } from './plugins/rest-props-plugin.ts'
import { stylePropsPlugin } from './plugins/style-props-plugin.ts'
import { svgNormalizationPlugin } from './plugins/svg-normalization-plugin.ts'

export function createDomPlugins(): Plugin<Element>[] {
  return [
    innerHTMLPlugin,
    stylePropsPlugin,
    formStatePlugin,
    connectPlugin,
    onPlugin,
    svgNormalizationPlugin,
    restPropsPlugin,
  ]
}

export {
  ariaDataAttributePlugin,
  attributeFallbackPlugin,
  connectPlugin,
  restPropsPlugin,
  domPropertyOrAttributePlugin,
  formStatePlugin,
  innerHTMLPlugin,
  onPlugin,
  stylePropsPlugin,
  svgNormalizationPlugin,
}
