import { createReconciler } from './root.ts'
import { ariaProps } from './plugins/aria-props.ts'
import { attributeProps } from './plugins/attribute-props.ts'
import { css } from './plugins/css.ts'
import { component } from './plugins/component.ts'
import { documentState } from './plugins/document-state.ts'
import { interactions } from './plugins/interaction.ts'
import { presence } from './plugins/presence.ts'
import { propAliases } from './plugins/prop-aliases.ts'
import { reflectedPropsPlugin } from './plugins/reflected-props.ts'
import { styleProps } from './plugins/style-props.ts'
import { svgProps } from './plugins/svg-props.ts'

export { createReconciler }
export { interactions as interactionPlugin } from './plugins/interaction.ts'
export { presence as presencePlugin } from './plugins/presence.ts'
export { documentState as documentStatePlugin } from './plugins/document-state.ts'
export { css as cssPlugin } from './plugins/css.ts'
export { propAliases as propAliasesPlugin } from './plugins/prop-aliases.ts'
export { ariaProps as ariaPropsPlugin } from './plugins/aria-props.ts'
export { reflectedPropsPlugin } from './plugins/reflected-props.ts'
export { styleProps as stylePropsPlugin } from './plugins/style-props.ts'
export { svgProps as svgPropsPlugin } from './plugins/svg-props.ts'
export { attributeProps as attributePropsPlugin } from './plugins/attribute-props.ts'
export { component as componentPlugin } from './plugins/component.ts'
export { connect as connectPlugin } from './plugins/connect.ts'
export { definePlugin } from './types.ts'

export function createRecommendedReconciler() {
  return createReconciler([
    documentState,
    component,
    interactions,
    css,
    presence,
    propAliases,
    ariaProps,
    reflectedPropsPlugin,
    styleProps,
    svgProps,
    attributeProps,
  ])
}

export type {
  Connect,
  FlushContext,
  HostChild,
  HostInput,
  HostTransformInput,
  HostTransform,
  HostRenderNode,
  Handle,
  SpikeHandle,
  Plugin as SpikePlugin,
  Task,
} from './types.ts'
