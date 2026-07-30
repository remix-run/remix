import type { ElementProps, ElementType, RemixElement, RemixNode } from '../jsx.ts';
export declare function createRemixElement(type: ElementType, props: ElementProps | null | undefined, key?: string): RemixElement;
export declare function isRemixElement(node: RemixNode): node is RemixElement;
