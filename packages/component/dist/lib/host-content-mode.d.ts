import type { ElementProps } from './jsx.ts';
import type { VNode } from './vnode.ts';
export type HostContentMode = 'children' | 'innerHTML';
export declare function getHostContentMode(props: ElementProps): HostContentMode;
export declare function getCanonicalHostChildren(mode: HostContentMode, children: VNode[]): VNode[];
