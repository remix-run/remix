import type { ComponentHandle, Fragment, Frame, FrameHandle, FrameProps } from './component.ts';
import { isRemixElement } from './core/vnode.ts';
import type { Frame as FrameInstance } from './frame.ts';
import type { RemixNode } from './jsx.ts';
import type { ElementFunction } from './element-function.ts';
import type { Key } from './key.ts';
import type { MixinRuntimeState, MixinRuntimeValue } from './mixins/mixin.ts';
import type { OnMixinDescriptor } from './mixins/on-mixin.ts';
import type { Scheduler } from './scheduler.ts';
import type { StyleManager } from '../style/index.ts';
export { isRemixElement };
export declare const TEXT_NODE: unique symbol;
export declare const NON_RENDER_NODE: unique symbol;
export declare const ROOT_VNODE: unique symbol;
export type VNodeKind = 'root' | 'empty' | 'text' | 'fragment' | 'host' | 'component' | 'frame';
export type RuntimeElementProps = {
    [name: string]: unknown;
};
export type RuntimeHostProps = RuntimeElementProps & {
    children?: RemixNode;
    innerHTML?: string;
    mix?: MixinRuntimeValue;
};
type InputNodeBase<kind extends VNodeKind, type> = {
    kind: kind;
    type: type;
    key?: Key;
    _parent?: never;
};
export type NonRenderNode = InputNodeBase<'empty', typeof NON_RENDER_NODE>;
export type TextNode = InputNodeBase<'text', typeof TEXT_NODE> & {
    _text: string;
};
export type FragmentNode = InputNodeBase<'fragment', typeof Fragment> & {
    _children: VNodeInput[];
};
export type HostNode = InputNodeBase<'host', string> & {
    props: RuntimeHostProps;
    _children: VNodeInput[];
};
export type ComponentNode = InputNodeBase<'component', ElementFunction> & {
    props: RuntimeElementProps;
};
export type FrameNode = InputNodeBase<'frame', typeof Frame> & {
    props: RuntimeElementProps & FrameProps;
};
export type VNodeInput = NonRenderNode | TextNode | FragmentNode | HostNode | ComponentNode | FrameNode;
type MountedNodeBase = {
    _parent: VNodeParent;
    _svg: boolean;
};
type CommittedNodeBase<kind extends VNodeKind, type> = {
    kind: kind;
    type: type;
    key?: Key;
} & MountedNodeBase;
export type CommittedNonRenderNode = CommittedNodeBase<'empty', typeof NON_RENDER_NODE>;
export type CommittedTextNode = CommittedNodeBase<'text', typeof TEXT_NODE> & {
    _text: string;
    _dom: Text;
};
export type ControlledReflectionState = {
    disposed: boolean;
    listenersAttached: boolean;
    pendingRestoreVersion: number;
    managesValue: boolean;
    managesChecked: boolean;
    hasControlledValue: boolean;
    controlledValue: unknown;
    hasControlledChecked: boolean;
    controlledChecked: unknown;
    onInput(): void;
    onChange(): void;
};
export type DirectEventBinding = {
    type: string;
    handler: (event: Event, signal: AbortSignal) => void | Promise<void>;
    capture: boolean;
    stableHandler: ((event: Event) => void) | null;
    reentry: AbortController | null;
};
export type DirectEventState = {
    bindings: DirectEventBinding[];
};
export type HostPersistenceState = {
    parent: ParentNode;
    token: number;
};
export type CommittedHostNode = CommittedNodeBase<'host', string> & {
    props: RuntimeHostProps;
    _children: CommittedVNode[];
    _dom: Element;
    _mixedProps: RuntimeHostProps;
    _mixState?: MixinRuntimeState;
    _directEventDescriptors?: OnMixinDescriptor[];
    _directEventState?: DirectEventState;
    _controlledState?: ControlledReflectionState;
    _persistence?: HostPersistenceState;
};
export type CommittedFragmentNode = CommittedNodeBase<'fragment', typeof Fragment> & {
    _children: CommittedVNode[];
};
export type MountingComponentNode = CommittedNodeBase<'component', ElementFunction> & {
    props: RuntimeElementProps;
    _handle: ComponentHandle;
    _context: ReconcileContext;
};
export type CommittedComponentNode = MountingComponentNode & {
    _content: CommittedVNode;
};
export interface FrameFallbackRoot {
    render(element: RemixNode): void;
    dispose(): void;
}
export type FrameMountState = {
    instance: FrameInstance;
    fallbackRoot?: FrameFallbackRoot;
    resolveToken: number;
    resolveController?: AbortController;
    resolved: boolean;
};
export type CommittedFrameNode = CommittedNodeBase<'frame', typeof Frame> & {
    props: RuntimeElementProps & FrameProps;
    _rangeStart: Comment;
    _rangeEnd: Comment;
    _state: FrameMountState;
};
export type CommittedVNode = CommittedNonRenderNode | CommittedTextNode | CommittedFragmentNode | CommittedHostNode | CommittedComponentNode | CommittedFrameNode;
export type RootVNode = {
    kind: 'root';
    type: typeof ROOT_VNODE;
    _children: CommittedVNode[];
    _svg: boolean;
    _rangeStart?: Node;
    _rangeEnd?: Node;
    _pendingHydrationComponentId?: string;
};
export interface ReconcileContext {
    frame: FrameHandle;
    scheduler: Scheduler;
    styles: StyleManager;
    rootTarget: EventTarget;
}
export type VNodeParent = RootVNode | CommittedFragmentNode | CommittedHostNode | MountingComponentNode | CommittedComponentNode;
export type VNode = VNodeInput | CommittedVNode | RootVNode | MountingComponentNode;
export declare function isFragmentNode(node: VNode): node is FragmentNode | CommittedFragmentNode;
export declare function isTextNode(node: VNode): node is TextNode | CommittedTextNode;
export declare function isNonRenderNode(node: VNode): node is NonRenderNode | CommittedNonRenderNode;
export declare function isCommittedTextNode(node: CommittedVNode): node is CommittedTextNode;
export declare function isHostNode(node: VNode): node is HostNode | CommittedHostNode;
export declare function isCommittedHostNode(node: CommittedVNode): node is CommittedHostNode;
export declare function isComponentNode(node: VNode): node is ComponentNode | MountingComponentNode | CommittedComponentNode;
export declare function isCommittedComponentNode(node: VNode): node is CommittedComponentNode;
export declare function isFrameNode(node: VNode): node is FrameNode | CommittedFrameNode;
export declare function isCommittedFrameNode(node: CommittedVNode): node is CommittedFrameNode;
export declare function findContextFromAncestry(node: VNodeParent, type: ElementFunction): unknown;
