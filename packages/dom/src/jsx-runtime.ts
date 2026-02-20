import {
  RECONCILER_FRAGMENT,
  RECONCILER_NODE_CHILDREN,
  RECONCILER_PROP_KEYS,
  RECONCILER_PROP_SHAPE,
} from '@remix-run/reconciler'
import type { Component, ReconcilerElement, RenderValue } from '@remix-run/reconciler'
import type { MixValue } from '@remix-run/reconciler'

export const Fragment = RECONCILER_FRAGMENT

export type DomJsxElement = ReconcilerElement
const EMPTY_NODE_CHILDREN: RenderValue[] = []

export type DispatchedEvent<event extends Event, node extends EventTarget> = event & {
  currentTarget: node
}

type EventMap<node extends EventTarget> = node extends HTMLElement
  ? HTMLElementEventMap
  : node extends SVGSVGElement
    ? SVGSVGElementEventMap
    : node extends SVGElement
      ? SVGElementEventMap
      : node extends Element
        ? ElementEventMap
        : node extends Window
          ? WindowEventMap
          : node extends Document
            ? DocumentEventMap
            : GlobalEventHandlersEventMap & Record<string, Event>

export type OnValue<node extends EventTarget> = {
  [type in Extract<keyof EventMap<node>, string>]?: (
    event: DispatchedEvent<EventMap<node>[type] extends Event ? EventMap<node>[type] : Event, node>,
  ) => void
} & {
  [type: string]: (event: DispatchedEvent<any, node>) => void
}

export type ConnectValue<node extends EventTarget> = (
  node: node,
  signal: AbortSignal,
) => void

export type {
  MixValue,
  MixinDescriptor,
  MixinType,
} from '@remix-run/reconciler'

export type DomElementProps<node extends EventTarget> = {
  children?: RenderValue
  connect?: ConnectValue<node>
  innerHTML?: string | null
  key?: unknown
  on?: OnValue<node>
  style?: Record<string, string | number | null | undefined>
  mix?: MixValue<node>
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
} & DomMathMLElements & {
  [tagName: string]: DomElementProps<Element>
}

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
    'children' in nextProps
      ? toNodeChildren(nextProps.children as RenderValue)
      : EMPTY_NODE_CHILDREN
  let propKeys = listRenderablePropKeys(nextProps)
  let element: DomJsxElement = {
    $rmx: true,
    type,
    key: resolvedKey ?? null,
    props: nextProps,
  }
  let cached = element as DomJsxElement & {
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
  export type Element = DomJsxElement
  export type ElementType = keyof IntrinsicElements | Component<any, any, RenderValue>
  export type IntrinsicElements = DomIntrinsicElements
  export interface ElementChildrenAttribute {
    children: unknown
  }
  export interface IntrinsicAttributes {
    key?: unknown
  }
  export type LibraryManagedAttributes<component, props> =
    component extends Component<infer setup, infer renderProps, any>
      ? (unknown extends setup
          ? {}
          : undefined extends setup
            ? { setup?: setup }
            : { setup: setup }) &
          renderProps
      : props
}
