import {
  RECONCILER_FRAGMENT,
  RECONCILER_NODE_CHILDREN,
  RECONCILER_PROP_KEYS,
  RECONCILER_PROP_SHAPE,
} from './jsx.ts'

export const Fragment = RECONCILER_FRAGMENT
const EMPTY_CHILDREN: RenderValue[] = []

export type ComponentHandle = {
  id: string
  update(): Promise<AbortSignal>
  queueTask(task: (signal: AbortSignal) => void): void
}
export type RenderValue =
  | ReconcilerJsxElement
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | RenderValue[]

export type Component<setup, renderProps> = (
  handle: ComponentHandle,
  setup: setup,
) => (props: renderProps) => RenderValue

export type ReconcilerJsxElement = {
  $rmx: true
  type: unknown
  key: unknown
  props: Record<string, unknown>
  [RECONCILER_NODE_CHILDREN]?: RenderValue[]
  [RECONCILER_PROP_KEYS]?: string[]
  [RECONCILER_PROP_SHAPE]?: string
}

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

  let propKeys = listRenderablePropKeys(nextProps)
  let element: ReconcilerJsxElement = {
    $rmx: true,
    type,
    key: resolvedKey ?? null,
    props: nextProps,
  }

  element[RECONCILER_NODE_CHILDREN] = toNodeChildren(nextProps.children as RenderValue)
  element[RECONCILER_PROP_KEYS] = propKeys
  element[RECONCILER_PROP_SHAPE] = toPropShape(propKeys)

  return element
}

function toNodeChildren(children: RenderValue): RenderValue[] {
  if (children == null || typeof children === 'boolean') return EMPTY_CHILDREN
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
