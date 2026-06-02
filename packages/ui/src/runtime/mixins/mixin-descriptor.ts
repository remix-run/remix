import type { Context, FrameHandle } from '../component.ts'
import { jsx, type ElementProps, type RemixElement } from '../jsx.ts'
import type { TypedEventTarget } from '../typed-event-target.ts'

type RebindNode<value, baseNode, boundNode> = value extends (
  ...args: infer fnArgs
) => infer fnResult
  ? (...args: RebindTuple<fnArgs, baseNode, boundNode>) => RebindNode<fnResult, baseNode, boundNode>
  : [value] extends [baseNode]
    ? [baseNode] extends [value]
      ? boundNode
      : value
    : value

type RebindTuple<args extends unknown[], baseNode, boundNode> = {
  [index in keyof args]: RebindNode<args[index], baseNode, boundNode>
}

export type MixinProps<
  node extends EventTarget = Element,
  props extends ElementProps = ElementProps,
> = Omit<props, 'children' | 'innerHTML' | 'mix'> & {
  mix?: MixValue<node, props>
}

export type MixinElement<
  node extends EventTarget = Element,
  props extends ElementProps = ElementProps,
> = ((
  handle: { update(): Promise<AbortSignal> },
  setup: unknown,
) => (props: MixinProps<node, props>) => RemixElement) & {
  __rmxMixinElementType: string
}

export type MixinInsertEvent<node extends EventTarget = Element> = Event & {
  node: node
  parent: ParentNode
  key?: string
}

export type MixinReclaimedEvent<node extends EventTarget = Element> = Event & {
  node: node
  parent: ParentNode
  key?: string
}

export type MixinUpdateEvent<node extends EventTarget = Element> = Event & {
  node: node
}

export type MixinBeforeRemoveEvent = Event & {
  persistNode(teardown: (signal: AbortSignal) => void | Promise<void>): void
}

export type MixinContext = Pick<Context<Record<string, never>>, 'get'>

export type MixinHandleEventMap<node extends EventTarget = Element> = {
  beforeRemove: MixinBeforeRemoveEvent
  reclaimed: MixinReclaimedEvent<node>
  remove: Event
  insert: MixinInsertEvent<node>
  beforeUpdate: MixinUpdateEvent<node>
  commit: MixinUpdateEvent<node>
}

/**
 * Runtime handle passed to mixin setup functions.
 *
 * Mixin render callbacks receive host props with `children` and `innerHTML` removed.
 * Returned mixin elements may patch host attributes and nested `mix`, but cannot replace
 * the host subtree.
 */
export type MixinHandle<
  node extends EventTarget = Element,
  props extends ElementProps = ElementProps,
> = TypedEventTarget<MixinHandleEventMap<node>> & {
  id: string
  context: MixinContext
  frame: FrameHandle
  element: MixinElement<node, props>
  signal: AbortSignal
  update(): Promise<AbortSignal>
  queueTask(task: (node: node, signal: AbortSignal) => void): void
}

export function renderMixinElement<
  node extends EventTarget = Element,
  props extends ElementProps = ElementProps,
>(element: MixinElement<node, props>, props?: MixinProps<node, props>): RemixElement {
  let { key, ...rest } = (props ?? {}) as MixinProps<node, props> & { key?: any }
  return jsx(element, rest, key)
}

export type MixinRuntimeType<
  args extends unknown[] = [],
  node extends EventTarget = Element,
  props extends ElementProps = ElementProps,
> = (
  handle: MixinHandle<node, props>,
  type: string,
) => ((...args: [...args, currentProps: props]) => MixinReturn<node, props>) | void

/**
 * Public mixin setup function signature.
 */
export type MixinType<
  node extends EventTarget = Element,
  args extends unknown[] = [],
  props extends ElementProps = ElementProps,
> = (
  handle: MixinHandle<node, props>,
  type: string,
) => ((...args: [...args, currentProps: props]) => MixinReturn<node, props>) | void

/**
 * Serializable descriptor stored in the `mix` prop.
 */
export type MixinDescriptor<
  node extends EventTarget = Element,
  args extends unknown[] = [],
  props extends ElementProps = ElementProps,
> = {
  type: MixinRuntimeType<args, node, props>
  args: args
  readonly __node?: (node: node) => void
}

export type MixinFactory<
  node extends EventTarget = Element,
  args extends unknown[] = [],
  props extends ElementProps = ElementProps,
> = <boundNode extends node = node>(
  ...args: RebindTuple<args, node, boundNode>
) => MixinDescriptor<boundNode, RebindTuple<args, node, boundNode>, props>

type PreviousMixDepth = [0, 0, 1, 2, 3, 4]
type FalsyMixValue = false | 0 | 0n | '' | null | undefined
type NullableMixValue<descriptor> = descriptor | FalsyMixValue
type NestedMixValue<descriptor, depth extends number = 4> = depth extends 0
  ? NullableMixValue<descriptor> | ReadonlyArray<NullableMixValue<descriptor>>
  :
      | NullableMixValue<descriptor>
      | ReadonlyArray<NestedMixValue<descriptor, PreviousMixDepth[depth]>>

/**
 * Accepted authoring shape for the `mix` prop on host elements.
 */
export type MixInput<
  node extends EventTarget = Element,
  props extends ElementProps = ElementProps,
> = NestedMixValue<MixinDescriptor<node, any, props>>

/**
 * Accepted value shape for the `mix` prop.
 */
export type MixValue<
  node extends EventTarget = Element,
  props extends ElementProps = ElementProps,
> = MixinDescriptor<node, any, props> | ReadonlyArray<MixinDescriptor<node, any, props>>

export type MixinReturn<
  node extends EventTarget = Element,
  props extends ElementProps = ElementProps,
> = void | null | RemixElement | MixinElement<node, props> | MixInput<node, props>

/**
 * Creates a typed mixin factory that can be passed through the `mix` prop.
 *
 * @param type Mixin setup function.
 * @returns A function that captures mixin arguments and returns a descriptor.
 */
export function createMixin<
  node extends EventTarget = Element,
  args extends unknown[] = [],
  props extends ElementProps = ElementProps,
>(type: MixinType<node, args, props>): MixinFactory<node, args, props> {
  return <boundNode extends node = node>(
    ...args: RebindTuple<args, node, boundNode>
  ): MixinDescriptor<boundNode, RebindTuple<args, node, boundNode>, props> => ({
    type: type as unknown as MixinRuntimeType<RebindTuple<args, node, boundNode>, boundNode, props>,
    args: args as RebindTuple<args, node, boundNode>,
  })
}
