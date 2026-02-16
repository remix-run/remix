export { createDomNodePolicy } from './lib/dom-node-policy.ts'
export {
  ariaDataAttributePlugin,
  attributeFallbackPlugin,
  createDomPlugins,
  domPropertyOrAttributePlugin,
  formStatePlugin,
  innerHTMLPlugin,
  stylePropsPlugin,
  svgNormalizationPlugin,
} from './lib/dom-plugins.ts'
export { Fragment, jsx, jsxs } from './jsx-runtime.ts'
export { jsxDEV } from './jsx-dev-runtime.ts'

export type {
  DomElementProps,
  DomHTMLElements,
  DomJsxElement,
  DomMathMLElements,
  DomSVGElements,
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
