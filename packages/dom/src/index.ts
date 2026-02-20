export { createDomNodePolicy } from './lib/dom-node-policy.ts'
export { createDomReconciler } from './lib/dom-reconciler.ts'
export {
  basicPropsPlugin,
  createMixin,
  createDomPlugins,
  mixPlugin,
  on,
  onPlugin,
  stylePropsPlugin,
} from './lib/dom-plugins.ts'
export { Fragment, jsx, jsxs } from './jsx-runtime.ts'
export { jsxDEV } from './jsx-dev-runtime.ts'

export type {
  ConnectValue,
  DomElementProps,
  DomHTMLElements,
  DomJsxElement,
  DomMathMLElements,
  DomSVGElements,
  DispatchedEvent,
  OnValue,
  MixValue,
  MixinDescriptor,
  MixinType,
} from './jsx-runtime.ts'

export type {
  DomElementNode,
  DomNode,
  DomNodePolicy,
  DomParentNode,
  DomTextNode,
  DomTraversal,
} from './lib/dom-node-policy.ts'

export type { Component } from '@remix-run/reconciler'
