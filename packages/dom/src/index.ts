export { createMixin, mixPlugin } from '@remix-run/reconciler'
export { createDomNodePolicy } from './lib/client/dom-node-policy.ts'
export { createDomReconciler } from './lib/client/dom-reconciler.ts'
export { clientEntry } from './lib/shared/hydration/client-entry.ts'
export {
  AFTER_FRAME_APPLY_EVENT,
  AfterFrameApplyEvent,
  BEFORE_FRAME_APPLY_EVENT,
  BeforeFrameApplyEvent,
  boot,
  RuntimeErrorEvent,
} from './lib/client/client-runtime.ts'
export { basicPropsPlugin } from './lib/client/plugins/basic-props-plugin.ts'
export { attributePropsPlugin } from './lib/client/plugins/attribute-props-plugin.ts'
export { createDocumentStatePlugin, getDocumentState } from './lib/client/plugins/document-state-plugin.ts'
export { stylePropsPlugin } from './lib/client/plugins/style-props-plugin.ts'
export { animateEntrance, animateExit } from './lib/client/mixins/animate-presence.tsx'
export { animateLayout } from './lib/client/mixins/animate-layout-mixin.tsx'
export { connect } from './lib/client/mixins/connect-mixin.tsx'
export { css } from './lib/client/mixins/css-mixin.tsx'
export { on } from './lib/client/mixins/on-mixin.tsx'
export { pressEvents } from './lib/client/mixins/press-mixin.tsx'
export { spring } from './lib/shared/spring.ts'
export { Fragment, jsx, jsxs } from './lib/shared/jsx/jsx-runtime.ts'
export { jsxDEV } from './lib/shared/jsx/jsx-dev-runtime.ts'

export type {
  DomElementProps,
  DomHTMLElements,
  DomJsxElement,
  DomMathMLElements,
  DomSVGElements,
  DispatchedEvent,
  MixValue,
  MixinDescriptor,
  MixinType,
} from './lib/shared/jsx/jsx-runtime.ts'
export type { Props } from './lib/shared/jsx/props.ts'

export type {
  DomElementNode,
  DomNode,
  DomNodePolicy,
  DomParentNode,
  DomTextNode,
  DomTraversal,
} from './lib/client/dom-node-policy.ts'

export type { Component, ComponentHandle } from '@remix-run/reconciler'
export type {
  BootOptions,
  ClientModuleLoader,
  DomRuntimeApplyKind,
  FrameHandle,
  FrameRegistry,
  ResolveFrame,
  RuntimeHandle,
} from './lib/client/client-runtime.ts'
export type {
  EntryComponent,
  HydrationData,
  SerializableArray,
  SerializableObject,
  SerializablePrimitive,
  SerializableProps,
  SerializableValue,
} from './lib/shared/hydration/client-entry.ts'
