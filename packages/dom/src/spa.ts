import { createDomReconciler } from './lib/client/dom-reconciler.ts'

export { createMixin, mixPlugin } from '@remix-run/reconciler'
export { createDomNodePolicy } from './lib/client/dom-node-policy.ts'
export { basicPropsPlugin } from './lib/client/plugins/basic-props-plugin.ts'
export { attributePropsPlugin } from './lib/client/plugins/attribute-props-plugin.ts'
export {
  createDocumentStatePlugin,
  getDocumentState,
} from './lib/client/plugins/document-state-plugin.ts'
export { stylePropsPlugin } from './lib/client/plugins/style-props-plugin.ts'
export { animateEntrance, animateExit } from './lib/client/mixins/animate-presence.tsx'
export { animateLayout } from './lib/client/mixins/animate-layout-mixin.tsx'
export { connect } from './lib/client/mixins/connect-mixin.tsx'
export { css } from './lib/client/mixins/css-mixin.tsx'
export { on } from './lib/client/mixins/on-mixin.tsx'
export { spring } from './lib/shared/spring.ts'
export { Fragment, jsx, jsxs } from './lib/shared/jsx/jsx-runtime.ts'
export { jsxDEV } from './lib/shared/jsx/jsx-dev-runtime.ts'

export type {
  DomElementProps,
  MixProp,
  MixinDescriptor,
  MixinType,
} from './lib/shared/jsx/jsx-runtime.ts'
export type { Props } from './lib/shared/jsx/props.ts'

export type {
  DomNodePolicyDefinition,
} from './lib/client/dom-node-policy.ts'

export type { Component, ComponentHandle } from '@remix-run/reconciler'

export function render(
  value: Parameters<ReturnType<ReturnType<typeof createDomReconciler>['createRoot']>['render']>[0],
  container: Parameters<ReturnType<typeof createDomReconciler>['createRoot']>[0],
  options?: Parameters<typeof createDomReconciler>[1],
) {
  let root = createDomReconciler(document, options).createRoot(container)
  root.render(value)
  return root
}
