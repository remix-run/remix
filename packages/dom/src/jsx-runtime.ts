import {
  RECONCILER_FRAGMENT,
  RECONCILER_NODE_CHILDREN,
  RECONCILER_PROP_KEYS,
  RECONCILER_PROP_SHAPE,
} from '@remix-run/reconciler'
import type { Component, NodeChild, ReconcilerElement, RenderValue, UseValue } from '@remix-run/reconciler'
import type { ConnectValue } from './lib/plugins/connect-plugin.ts'
import type { DispatchedEvent, OnValue } from './lib/plugins/on-plugin.ts'

export const Fragment = RECONCILER_FRAGMENT

export type DomJsxElement = ReconcilerElement
const EMPTY_NODE_CHILDREN: NodeChild[] = []

export type DomElementProps<node extends EventTarget> = {
  children?: RenderValue
  connect?: ConnectValue<node>
  innerHTML?: string
  key?: unknown
  on?: OnValue<node>
  use?: UseValue<node>
} & Record<string, unknown>

export type { ConnectValue, DispatchedEvent, OnValue }

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
  let nodeChildren =
    'children' in nextProps ? toNodeChildren(nextProps.children as RenderValue) : EMPTY_NODE_CHILDREN
  let propKeys = listRenderablePropKeys(nextProps)
  let element: DomJsxElement = {
    $rmx: true,
    type,
    key: resolvedKey ?? null,
    props: nextProps,
  }
  let cached = element as DomJsxElement & {
    [RECONCILER_NODE_CHILDREN]?: NodeChild[]
    [RECONCILER_PROP_KEYS]?: string[]
    [RECONCILER_PROP_SHAPE]?: string
  }
  cached[RECONCILER_NODE_CHILDREN] = nodeChildren
  cached[RECONCILER_PROP_KEYS] = propKeys
  cached[RECONCILER_PROP_SHAPE] = toPropShape(propKeys)
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
  let element = children as DomJsxElement & { [RECONCILER_NODE_CHILDREN]?: NodeChild[] }
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
      propKeys: (element as DomJsxElement & { [RECONCILER_PROP_KEYS]?: string[] })[RECONCILER_PROP_KEYS],
      propShape:
        (element as DomJsxElement & { [RECONCILER_PROP_SHAPE]?: string })[RECONCILER_PROP_SHAPE],
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
