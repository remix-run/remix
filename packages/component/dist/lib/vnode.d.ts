import type { EventsContainer } from '@remix-run/interaction';
import type { ComponentHandle, Component } from './component.ts';
import { Fragment, Frame } from './component.ts';
import type { ElementProps, RemixElement, RemixNode } from './jsx.ts';
export declare const TEXT_NODE: unique symbol;
export declare const ROOT_VNODE: unique symbol;
export type VNodeType = typeof ROOT_VNODE | string | Function | typeof TEXT_NODE | typeof Fragment | typeof Frame;
export type VNode<T extends VNodeType = VNodeType> = {
    type: T;
    props?: ElementProps;
    key?: string;
    _parent?: VNode;
    _children?: VNode[];
    _dom?: unknown;
    _events?: EventsContainer<EventTarget>;
    _controller?: AbortController;
    _svg?: boolean;
    _rangeStart?: Node;
    _rangeEnd?: Node;
    _index?: number;
    _flags?: number;
    _text?: string;
    _handle?: ComponentHandle;
    _id?: string;
    _content?: VNode;
    _animation?: Animation;
    _exiting?: boolean;
    _exitingParent?: ParentNode;
};
export type FragmentNode = VNode & {
    type: typeof Fragment;
    _children: VNode[];
};
export type TextNode = VNode & {
    type: typeof TEXT_NODE;
    _text: string;
};
export type CommittedTextNode = TextNode & {
    _dom: Text;
};
export type HostNode = VNode & {
    type: string;
    props: ElementProps;
    _children: VNode[];
};
export type CommittedHostNode = HostNode & {
    _dom: Element;
    _controller?: AbortController;
    _events?: EventsContainer<EventTarget>;
};
export type ComponentNode = VNode & {
    type: Function;
    props: ElementProps;
    _handle: ComponentHandle;
};
export type CommittedComponentNode = VNode & {
    type: Function;
    props: ElementProps;
    _content: VNode;
    _handle: ComponentHandle;
};
export declare function isFragmentNode(node: VNode): node is FragmentNode;
export declare function isTextNode(node: VNode): node is TextNode;
export declare function isCommittedTextNode(node: VNode): node is CommittedTextNode;
export declare function isHostNode(node: VNode): node is HostNode;
export declare function isCommittedHostNode(node: VNode): node is CommittedHostNode;
export declare function isComponentNode(node: VNode): node is ComponentNode;
export declare function isCommittedComponentNode(node: VNode): node is CommittedComponentNode;
export declare function isRemixElement(node: RemixNode): node is RemixElement;
export declare function findContextFromAncestry(node: VNode, type: Component): unknown;
