import {
  createReconcilerElement,
  RECONCILER_FRAGMENT,
  RECONCILER_NODE_CHILDREN,
  RECONCILER_PROP_KEYS,
  RECONCILER_PROP_SHAPE,
} from './jsx.ts'
import type { NodeChild, RenderValue } from '../lib/types.ts'
import type { Component } from '../lib/types.ts'

export const Fragment = RECONCILER_FRAGMENT

export type ReconcilerJsxElement = ReturnType<typeof createReconcilerElement>
const EMPTY_NODE_CHILDREN: NodeChild[] = []

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
  let children =
    'children' in nextProps ? toNodeChildren(nextProps.children as RenderValue) : EMPTY_NODE_CHILDREN
  let propKeys = listRenderablePropKeys(nextProps)
  let element = createReconcilerElement(type, nextProps, resolvedKey ?? null) as ReconcilerJsxElement & {
    [RECONCILER_NODE_CHILDREN]?: NodeChild[]
    [RECONCILER_PROP_KEYS]?: string[]
    [RECONCILER_PROP_SHAPE]?: string
  }
  element[RECONCILER_NODE_CHILDREN] = children
  element[RECONCILER_PROP_KEYS] = propKeys
  element[RECONCILER_PROP_SHAPE] = toPropShape(propKeys)
  return element
}

function toNodeChildren(children: RenderValue): NodeChild[] {
  if (children == null || typeof children === 'boolean') return EMPTY_NODE_CHILDREN
  if (typeof children === 'string') return [children]
  if (typeof children === 'number' || typeof children === 'bigint') return [String(children)]
  let output: NodeChild[] = []
  toNodeChildrenInto(children, output)
  return output.length === 0 ? EMPTY_NODE_CHILDREN : output
}

function toNodeChildrenInto(children: RenderValue, output: NodeChild[]) {
  if (children == null || typeof children === 'boolean') return
  if (typeof children === 'string') {
    output.push(children)
    return
  }
  if (typeof children === 'number' || typeof children === 'bigint') {
    output.push(String(children))
    return
  }
  if (Array.isArray(children)) {
    for (let child of children) {
      toNodeChildrenInto(child, output)
    }
    return
  }
  if (typeof children === 'object' && children && 'kind' in children) {
    let direct = children as { kind?: unknown; input?: unknown; value?: unknown }
    if (direct.kind === 'node' && direct.input) {
      output.push(children as unknown as NodeChild)
      return
    }
    if (direct.kind === 'text' && typeof direct.value === 'string') {
      output.push(direct.value)
      return
    }
  }
  if (!children || typeof children !== 'object') return
  let element = children as ReconcilerJsxElement & {
    [RECONCILER_NODE_CHILDREN]?: NodeChild[]
    [RECONCILER_PROP_KEYS]?: string[]
    [RECONCILER_PROP_SHAPE]?: string
  }
  if (!element.$rmx) return
  if (element.type === RECONCILER_FRAGMENT) {
    let cached = element[RECONCILER_NODE_CHILDREN]
    if (cached) {
      for (let child of cached) output.push(child)
      return
    }
    toNodeChildrenInto(element.props.children as RenderValue, output)
    return
  }
  output.push({
    kind: 'node',
    input: {
      type: element.type,
      key: element.key,
      props: splitChildrenProps(element.props),
      children: element[RECONCILER_NODE_CHILDREN] ?? [],
      propKeys: element[RECONCILER_PROP_KEYS],
      propShape: element[RECONCILER_PROP_SHAPE],
    },
  })
}

function splitChildrenProps(props: Record<string, unknown>) {
  if (!('children' in props)) return props
  let nextProps: Record<string, unknown> = {}
  for (let key in props) {
    if (key === 'children') continue
    nextProps[key] = props[key]
  }
  return nextProps
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
