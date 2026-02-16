import { RECONCILER_FRAGMENT } from '@remix-run/reconciler'
import type { Component, ReconcilerElement, RenderValue } from '@remix-run/reconciler'

export const Fragment = RECONCILER_FRAGMENT

export type DomJsxElement = ReconcilerElement

export type DomElementProps<node extends EventTarget> = {
  children?: RenderValue
  innerHTML?: string
  key?: unknown
} & Record<string, unknown>

export type DomHTMLElements = {
  [tagName in keyof HTMLElementTagNameMap]: DomElementProps<HTMLElementTagNameMap[tagName]>
}

export type DomSVGElements = {
  [tagName in keyof SVGElementTagNameMap]: DomElementProps<SVGElementTagNameMap[tagName]>
}

export type DomMathMLElements = {
  [tagName in keyof MathMLElementTagNameMap]: DomElementProps<MathMLElementTagNameMap[tagName]>
}

type SharedTagNames = Extract<keyof DomHTMLElements, keyof DomSVGElements>

type DomIntrinsicElements = {
  [tagName in Exclude<keyof DomHTMLElements, SharedTagNames>]: DomHTMLElements[tagName]
} & {
  [tagName in Exclude<keyof DomSVGElements, SharedTagNames>]: DomSVGElements[tagName]
} & {
  [tagName in SharedTagNames]: DomElementProps<Element>
} & DomMathMLElements

export function jsx(
  type: unknown,
  props: null | Record<string, unknown>,
  key?: unknown,
): DomJsxElement {
  return createElement(type, props, key)
}

export function jsxs(
  type: unknown,
  props: null | Record<string, unknown>,
  key?: unknown,
): DomJsxElement {
  return createElement(type, props, key)
}

function createElement(
  type: unknown,
  props: null | Record<string, unknown>,
  key: unknown,
): DomJsxElement {
  let nextProps = props ? { ...props } : {}
  let resolvedKey = key
  if (resolvedKey == null && 'key' in nextProps) {
    resolvedKey = nextProps.key
    delete nextProps.key
  }
  return {
    $rmx: true,
    type,
    key: resolvedKey ?? null,
    props: nextProps,
  }
}

export namespace JSX {
  export type Element = DomJsxElement
  export type ElementType = keyof IntrinsicElements | Component<any, any>
  export type IntrinsicElements = DomIntrinsicElements
  export interface ElementChildrenAttribute {
    children: unknown
  }
  export interface IntrinsicAttributes {
    key?: unknown
  }
  export type LibraryManagedAttributes<component, props> =
    component extends Component<infer setup, infer renderProps>
      ? (unknown extends setup
          ? {}
          : undefined extends setup
            ? { setup?: setup }
            : { setup: setup }) &
          renderProps
      : props
}
