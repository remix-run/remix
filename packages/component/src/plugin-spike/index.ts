import { createReconciler } from './root.ts'
import { createHydrationPolicy } from './hydration-policy.ts'
import { ariaProps } from './plugins/aria-props.ts'
import { attributeProps } from './plugins/attribute-props.ts'
import { css as cssPlugin } from './plugins/css.ts'
import { component } from './plugins/component.ts'
import { documentState } from './plugins/document-state.ts'
import { interactions } from './plugins/interaction.ts'
import { use } from './plugins/use.ts'
import { presence } from './plugins/presence.ts'
import { propAliases } from './plugins/prop-aliases.ts'
import { reflectedPropsPlugin } from './plugins/reflected-props.ts'
import { styleProps } from './plugins/style-props.ts'
import { svgProps } from './plugins/svg-props.ts'
import { connect } from './plugins/connect.ts'

export { createReconciler }
export { interactions as interactionPlugin } from './plugins/interaction.ts'
export { use as usePlugin } from './plugins/use.ts'
export { createDirective } from './plugins/use.ts'
export { on } from './plugins/on.ts'
export { css } from './plugins/css-directive.ts'
export { draggable, dragStartEvent, dragEndEvent } from './plugins/draggable.ts'
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
export { createHydrationPolicy }

export function createRecommendedReconciler() {
  return createReconciler([
    documentState,
    component,
    connect,
    use,
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
  HydrationPolicy,
  Handle,
  SpikeHandle,
  Plugin as SpikePlugin,
  Task,
} from './types.ts'
