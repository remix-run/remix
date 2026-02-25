export { createDomNodePolicy } from './lib/dom-node-policy.ts'
export { createDomReconciler } from './lib/dom-reconciler.ts'
export { clientEntry } from './lib/client-entry.ts'
export {
  AFTER_FRAME_APPLY_EVENT,
  AfterFrameApplyEvent,
  BEFORE_FRAME_APPLY_EVENT,
  BeforeFrameApplyEvent,
  boot,
  RuntimeErrorEvent,
} from './lib/client-runtime.ts'
export { renderToHTMLStream } from './lib/render-to-html-stream.ts'
export {
  animateEntrance,
  animateExit,
  animateLayout,
  basicPropsPlugin,
  connect,
  createMixin,
  css,
  createDomPlugins,
  createDocumentStatePlugin,
  getDocumentState,
  mixPlugin,
  on,
  pressEvents,
  spring,
  stylePropsPlugin,
} from './lib/dom-plugins.ts'
export { Fragment, jsx, jsxs } from './lib/jsx/jsx-runtime.ts'
export { jsxDEV } from './lib/jsx/jsx-dev-runtime.ts'

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
} from './lib/jsx/jsx-runtime.ts'

export type {
  DomElementNode,
  DomNode,
  DomNodePolicy,
  DomParentNode,
  DomTextNode,
  DomTraversal,
} from './lib/dom-node-policy.ts'

export type { Component, ComponentHandle } from '@remix-run/reconciler'
export type {
  BootOptions,
  ClientModuleLoader,
  DomRuntimeApplyKind,
  FrameHandle,
  FrameRegistry,
  ResolveFrame,
  RuntimeHandle,
} from './lib/client-runtime.ts'
export type {
  EntryComponent,
  HydrationData,
  SerializableArray,
  SerializableObject,
  SerializablePrimitive,
  SerializableProps,
  SerializableValue,
} from './lib/client-entry.ts'
export type { RenderToHTMLStreamOptions } from './lib/render-to-html-stream.ts'
