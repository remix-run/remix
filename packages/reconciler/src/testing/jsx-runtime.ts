import { createReconcilerElement, RECONCILER_FRAGMENT } from './jsx.ts'

export const Fragment = RECONCILER_FRAGMENT

export type ReconcilerJsxElement = ReturnType<typeof createReconcilerElement>

export function jsx(type: unknown, props: null | Record<string, unknown>, key?: unknown): ReconcilerJsxElement {
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
  export type ElementType = string | ((props: any) => Element)
  export interface IntrinsicElements {
    [name: string]: Record<string, unknown>
  }
  export interface ElementChildrenAttribute {
    children: unknown
  }
}
