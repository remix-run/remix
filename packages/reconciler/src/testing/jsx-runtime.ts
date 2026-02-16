import { createReconcilerElement, RECONCILER_FRAGMENT } from './jsx.ts'
import type { Component } from '../lib/types.ts'

export const Fragment = RECONCILER_FRAGMENT

export type ReconcilerJsxElement = ReturnType<typeof createReconcilerElement>

export function jsx(
  type: unknown,
  props: null | Record<string, unknown>,
  key?: unknown,
): ReconcilerJsxElement {
  return createElement(type, props, key)
}

export function jsxs(
  type: unknown,
  props: null | Record<string, unknown>,
  key?: unknown,
): ReconcilerJsxElement {
  return createElement(type, props, key)
}

function createElement(
  type: unknown,
  props: null | Record<string, unknown>,
  key: unknown,
): ReconcilerJsxElement {
  let nextProps = props ? { ...props } : {}
  let resolvedKey = key
  if (resolvedKey == null && 'key' in nextProps) {
    resolvedKey = nextProps.key
    delete nextProps.key
  }
  return createReconcilerElement(type, nextProps, resolvedKey ?? null)
}

export namespace JSX {
  export type Element = ReconcilerJsxElement
  export type ElementType = keyof IntrinsicElements | Component<any, any>
  export interface IntrinsicElements {
    [name: string]: Record<string, unknown>
  }
  export interface ElementChildrenAttribute {
    children: unknown
  }
  export interface IntrinsicAttributes {
    key?: unknown
  }
  export type LibraryManagedAttributes<component, props> = component extends Component<
    infer setup,
    infer renderProps
  >
    ? (unknown extends setup ? {} : undefined extends setup ? { setup?: setup } : { setup: setup }) &
        renderProps
    : props
}
