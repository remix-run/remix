import type { RemixNode } from '../jsx.ts';
export type EmptyChild = boolean | null | undefined;
export type PrimitiveChild = string | number | bigint;
export declare function isEmptyChild(value: RemixNode): value is EmptyChild;
export declare function isPrimitiveChild(value: RemixNode): value is PrimitiveChild;
export declare function normalizeChildren(children: readonly RemixNode[]): RemixNode[];
export declare function packChildren(children: readonly RemixNode[]): RemixNode | undefined;
