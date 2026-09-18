import type { ElementProps, ElementType, RemixElement } from '../jsx.ts';
export declare function createRemixElement(type: ElementType, props: ElementProps | null | undefined, key?: any): RemixElement;
export declare function isRemixElement(node: unknown): node is RemixElement;
