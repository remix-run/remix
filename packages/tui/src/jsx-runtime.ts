import {
  RECONCILER_FRAGMENT,
  RECONCILER_NODE_CHILDREN,
  RECONCILER_PROP_KEYS,
  RECONCILER_PROP_SHAPE,
} from '@remix-run/reconciler'
import type { ReconcilerElement, RenderValue } from '@remix-run/reconciler'

export const Fragment = RECONCILER_FRAGMENT
export type TuiJsxElement = ReconcilerElement
const EMPTY_NODE_CHILDREN: RenderValue[] = []

export type TuiStyleValue = Record<string, string | number | boolean | null | undefined>
export type TuiLayoutValue = Record<string, string | number | boolean | null | undefined>
export type TuiOnValue = Record<string, ((...args: unknown[]) => void) | undefined>

export type TuiElementProps = {
  children?: RenderValue
  key?: unknown
  style?: TuiStyleValue
  layout?: TuiLayoutValue
  on?: TuiOnValue
} & Record<string, unknown>

export function jsx(
  type: unknown,
  props: null | Record<string, unknown>,
  key?: unknown,
): TuiJsxElement {
  return createElement(type, props, key)
}

export function jsxs(
  type: unknown,
  props: null | Record<string, unknown>,
  key?: unknown,
): TuiJsxElement {
  return createElement(type, props, key)
}

function createElement(
  type: unknown,
  props: null | Record<string, unknown>,
  key: unknown,
): TuiJsxElement {
  let nextProps = props ? { ...props } : {}
  let resolvedKey = key
  if (resolvedKey == null && 'key' in nextProps) {
    resolvedKey = nextProps.key
    delete nextProps.key
  }
  let nodeChildren =
    'children' in nextProps
      ? toNodeChildren(nextProps.children as RenderValue)
      : EMPTY_NODE_CHILDREN
  let propKeys = listRenderablePropKeys(nextProps)
  let element: TuiJsxElement = {
    $rmx: true,
    type,
    key: resolvedKey ?? null,
    props: nextProps,
  }
  let cached = element as TuiJsxElement & {
    [RECONCILER_NODE_CHILDREN]?: RenderValue[]
    [RECONCILER_PROP_KEYS]?: string[]
    [RECONCILER_PROP_SHAPE]?: string
  }
  cached[RECONCILER_NODE_CHILDREN] = nodeChildren
  cached[RECONCILER_PROP_KEYS] = propKeys
  cached[RECONCILER_PROP_SHAPE] = toPropShape(propKeys)
  return element
}

function toNodeChildren(children: RenderValue): RenderValue[] {
  if (children == null || typeof children === 'boolean') return EMPTY_NODE_CHILDREN
  if (Array.isArray(children)) return children
  return [children]
}

function listRenderablePropKeys(props: Record<string, unknown>) {
  let keys: string[] = []
  for (let key in props) {
    if (key === 'children') continue
    keys.push(key)
  }
  return keys
}

function toPropShape(keys: string[]) {
  if (keys.length === 0) return ''
  return keys.join('\u0001')
}

export namespace JSX {
  export type Element = TuiJsxElement
  export type ElementType =
    | keyof IntrinsicElements
    | ((handle: import('@remix-run/reconciler').ComponentHandle<any>, setup: any) => (props: any) => any)
  export interface IntrinsicElements {
    [name: string]: TuiElementProps
  }
  export interface ElementChildrenAttribute {
    children: unknown
  }
  export interface IntrinsicAttributes {
    key?: unknown
  }
  export type LibraryManagedAttributes<component, props> =
    component extends (
      handle: import('@remix-run/reconciler').ComponentHandle<any>,
      setup: infer setup,
    ) => (props: infer renderProps) => any
      ? (unknown extends setup
          ? {}
          : undefined extends setup
            ? { setup?: setup }
            : { setup: setup }) &
          renderProps
      : props
}
