import type { Context, FrameHandle } from '../component.ts';
import type { ElementProps, RemixElement } from '../jsx.ts';
import type { Key } from '../key.ts';
import type { Scheduler } from '../scheduler.ts';
import { TypedEventTarget } from '../typed-event-target.ts';
type RebindNode<value, baseNode, boundNode> = value extends (...args: infer fnArgs) => infer fnResult ? (...args: RebindTuple<fnArgs, baseNode, boundNode>) => RebindNode<fnResult, baseNode, boundNode> : [value] extends [baseNode] ? [baseNode] extends [value] ? boundNode : value : value;
type RebindTuple<args extends unknown[], baseNode, boundNode> = {
    [index in keyof args]: RebindNode<args[index], baseNode, boundNode>;
};
/**
 * Host props available to a mixin, excluding subtree content owned by the host.
 */
export type MixinProps<node extends EventTarget = Element, props extends ElementProps = ElementProps> = Omit<props, 'children' | 'innerHTML' | 'srcDoc' | 'srcdoc' | 'outerHTML' | 'mix'> & {
    mix?: MixValue<node, props>;
};
/**
 * JSX element used by a mixin to forward or patch its existing host props.
 */
export type MixinElement<node extends EventTarget = Element, props extends ElementProps = ElementProps> = ((handle: {
    update(): Promise<AbortSignal>;
}, setup: unknown) => (props: MixinProps<node, props>) => RemixElement) & {
    __rmxMixinElementType: string;
};
/**
 * Event dispatched after a mixin is bound to its host node in the commit phase.
 */
export type MixinInsertEvent<node extends EventTarget = Element> = Event & {
    /** The bound host node. */
    node: node;
    /** The host node's DOM parent. */
    parent: ParentNode;
    /** The host's reconciliation key, when provided. */
    key?: Key;
};
/**
 * Event dispatched when a persisted keyed host is reused before its removal finishes.
 */
export type MixinReclaimedEvent<node extends EventTarget = Element> = Event & {
    /** The bound host node. */
    node: node;
    /** The host node's DOM parent. */
    parent: ParentNode;
    /** The host's reconciliation key, when provided. */
    key?: Key;
};
/**
 * Event dispatched before DOM updates or after they commit for the host's update scope.
 */
export type MixinUpdateEvent<node extends EventTarget = Element> = Event & {
    /** The host node being measured or updated. */
    node: node;
};
/**
 * Event dispatched before host removal, while mixins can still defer that removal.
 */
export type MixinBeforeRemoveEvent = Event & {
    /**
     * Keeps the host in the DOM until all registered teardown callbacks settle.
     *
     * Call synchronously from the `beforeRemove` listener. Callbacks run asynchronously;
     * returning `void`, throwing, or rejecting completes that callback's hold on the node.
     * Callback errors do not prevent removal. The signal aborts when the pending removal
     * is canceled, including keyed-node reclamation, or the host is torn down. Check it
     * before starting work and use it to stop unfinished work. A reclaimed node emits
     * `reclaimed` instead of `remove` and is not removed when the old callbacks settle.
     *
     * @param teardown Work to finish before removing the host, with a cancellation signal.
     */
    persistNode(teardown: (signal: AbortSignal) => void | Promise<void>): void;
};
type MixinContext = Pick<Context<Record<string, never>>, 'get'>;
type MixinHandleEventMap<node extends EventTarget = Element> = {
    /** Host removal has begun. Register deferred teardown with `event.persistNode()`. */
    beforeRemove: MixinBeforeRemoveEvent;
    /** A persisted keyed host was reused without another `insert` event. */
    reclaimed: MixinReclaimedEvent<node>;
    /** The mixin is being disposed, including when its slot changes on a retained host. */
    remove: Event;
    /** The mixin has been bound to a host, including an already-mounted host. */
    insert: MixinInsertEvent<node>;
    /** The host's update scope is about to change the DOM. */
    beforeUpdate: MixinUpdateEvent<node>;
    /** DOM changes in the host's update scope have committed. */
    commit: MixinUpdateEvent<node>;
};
/**
 * Runtime handle passed to mixin setup functions.
 *
 * The node type is covariant so a handle for a subtype host can be used by a mixin authored for
 * its base type. Mixin render callbacks receive host props with children and raw HTML props
 * removed.
 * Returned mixin elements may patch host attributes and nested `mix`, but cannot replace
 * the host subtree.
 */
export interface MixinHandle<out node extends EventTarget = Element, props extends ElementProps = ElementProps> extends TypedEventTarget<MixinHandleEventMap<node>> {
    /** Identifier shared by the mixins bound to this host. */
    id: string;
    /** Reads context provided by an ancestor component. */
    context: MixinContext;
    /** The frame containing this host. */
    frame: FrameHandle;
    /** JSX element for forwarding host props, patching attributes, and composing nested mixins. */
    element: MixinElement<node, props>;
    /**
     * Signal aborted when this mixin slot is disposed, even if its host remains mounted.
     * Read it during setup or render and capture it for use in asynchronous callbacks.
     */
    signal: AbortSignal;
    /**
     * Schedules an update of the host's mixins without rerendering its owner component.
     *
     * @returns A promise that resolves after the update with the host runtime's lifetime signal.
     */
    update(): Promise<AbortSignal>;
    /**
     * Queues work after pending DOM updates and commit-phase callbacks.
     *
     * @param task Callback receiving the bound host and its runtime lifetime signal.
     */
    queueTask(task: (node: node, signal: AbortSignal) => void): void;
}
export declare function renderMixinElement<node extends EventTarget = Element, props extends ElementProps = ElementProps>(element: MixinElement<node, props>, props?: MixinProps<node, props>): RemixElement;
type MixinRuntimeType<args extends unknown[] = [], node extends EventTarget = Element, props extends ElementProps = ElementProps> = (handle: MixinHandle<node, props>, type: string) => ((...args: [...args, currentProps: props]) => MixinReturn<node, props>) | void;
type MixinDescriptorType<args extends unknown[] = [], node extends EventTarget = Element, props extends ElementProps = ElementProps> = <boundNode extends node>(handle: MixinHandle<boundNode, props>, type: string) => ((...args: [...args, currentProps: props]) => MixinReturn<boundNode, props>) | void;
/**
 * Setup function called once per mixin slot with its handle and host tag name.
 *
 * The returned render function receives the factory arguments followed by current host props.
 * Return `handle.element` to preserve props, JSX using `handle.element` to patch them, or mixin
 * descriptors to compose more behavior. Returning nothing from setup preserves the host props.
 */
export type MixinType<node extends EventTarget = Element, args extends unknown[] = [], props extends ElementProps = ElementProps> = (handle: MixinHandle<node, props>, type: string) => ((...args: [...args, currentProps: props]) => MixinReturn<node, props>) | void;
/**
 * Descriptor pairing a mixin setup function with the arguments captured by its factory.
 */
export type MixinDescriptor<in node extends EventTarget = Element, args extends unknown[] = [], props extends ElementProps = ElementProps> = {
    /** Setup function identifying this mixin. */
    type: MixinDescriptorType<args, node, props>;
    /** Arguments supplied to the mixin factory for this render. */
    args: args;
    /** Type-only marker constraining which hosts can accept this descriptor. */
    readonly __node?: (node: node) => void;
};
/**
 * Callable factory that captures arguments for a mixin used in a host's `mix` prop.
 */
export type MixinFactory<node extends EventTarget = Element, args extends unknown[] = [], props extends ElementProps = ElementProps> = <boundNode extends node = node>(...args: RebindTuple<args, node, boundNode>) => MixinDescriptor<boundNode, RebindTuple<args, node, boundNode>, props>;
type PreviousMixDepth = [0, 0, 1, 2, 3, 4];
type FalsyMixValue = false | 0 | 0n | '' | null | undefined;
type NullableMixValue<descriptor> = descriptor | FalsyMixValue;
type NestedMixValue<descriptor, depth extends number = 4> = depth extends 0 ? NullableMixValue<descriptor> | ReadonlyArray<NullableMixValue<descriptor>> : NullableMixValue<descriptor> | ReadonlyArray<NestedMixValue<descriptor, PreviousMixDepth[depth]>>;
type MixinInputDescriptor<in node extends EventTarget = Element, props extends ElementProps = ElementProps> = {
    type: (handle: MixinHandle<node, props>, type: string) => unknown;
    args: readonly unknown[];
    readonly __node?: (node: node) => void;
};
/**
 * Accepted authoring shape for the `mix` prop on host elements.
 * Nested arrays are flattened and falsy entries are ignored, allowing conditional mixins.
 */
export type MixInput<node extends EventTarget = Element, props extends ElementProps = ElementProps> = NestedMixValue<MixinInputDescriptor<node, props>>;
/**
 * Descriptor or flat descriptor array after nested and conditional mixin inputs are normalized.
 */
export type MixValue<node extends EventTarget = Element, props extends ElementProps = ElementProps> = MixinInputDescriptor<node, props> | ReadonlyArray<MixinInputDescriptor<node, props>>;
type MixinReturn<node extends EventTarget = Element, props extends ElementProps = ElementProps> = void | null | RemixElement | MixinElement<node, props> | MixInput<node, props>;
type AnyMixinType = MixinRuntimeType<unknown[], Element, ElementProps>;
type AnyMixinDescriptor = MixinDescriptor<Element, unknown[], ElementProps>;
export type MixinRuntimeValue = AnyMixinDescriptor | ReadonlyArray<AnyMixinDescriptor>;
type AnyMixinRunner = (...args: [...unknown[], currentProps: ElementProps]) => MixinReturn<Element, ElementProps>;
type AnyMixinHandle = MixinHandle<Element, ElementProps>;
type RunnerEntry = {
    type: AnyMixinType;
    runner: AnyMixinRunner;
    scope: symbol;
};
export type MixinRuntimeBinding<target = unknown> = {
    node: Element;
    parent: ParentNode;
    key?: Key;
    target: target;
    frame: FrameHandle;
    scheduler: Scheduler;
    enqueueUpdate(done: (signal: AbortSignal) => void): void;
};
type ResolveMixedPropsInput = {
    hostType: string;
    frame: FrameHandle;
    scheduler: Scheduler;
    getContext?: MixinContext['get'];
    props: ElementProps;
    state?: MixinRuntimeState;
};
type ResolveMixedPropsOutput = {
    props: ElementProps;
    state: MixinRuntimeState;
};
export type MixinRuntimeState = {
    id: string;
    controller?: AbortController;
    aborted: boolean;
    handle?: AnyMixinHandle;
    runners: RunnerEntry[];
    binding?: MixinRuntimeBinding;
    removePrepared?: boolean;
    pendingRemoval?: {
        signal: AbortSignal;
        cancel: (reason?: unknown) => void;
        done: Promise<void>;
    };
};
/**
 * Creates a typed mixin factory that can be passed through the `mix` prop.
 *
 * @param type Mixin setup function.
 * @returns A function that captures mixin arguments and returns a descriptor.
 */
export declare function createMixin<node extends EventTarget = Element, args extends unknown[] = [], props extends ElementProps = ElementProps>(type: MixinType<node, args, props>): MixinFactory<node, args, props>;
export declare function resolveMixedProps(input: ResolveMixedPropsInput): ResolveMixedPropsOutput;
export declare function teardownMixins(state?: MixinRuntimeState): void;
export declare function bindMixinRuntime<target>(state: MixinRuntimeState | undefined, binding?: MixinRuntimeBinding<target>, options?: {
    dispatchReclaimed?: boolean;
}): void;
export declare function prepareMixinRemoval(state?: MixinRuntimeState): Promise<void> | undefined;
export declare function cancelPendingMixinRemoval(state?: MixinRuntimeState, reason?: unknown): void;
export declare function getMixinRuntimeSignal(state: MixinRuntimeState): AbortSignal;
export declare function dispatchMixinBeforeUpdate(state?: MixinRuntimeState): void;
export declare function dispatchMixinCommit(state?: MixinRuntimeState): void;
export {};
