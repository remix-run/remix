import type { ElementType, RemixElement } from './jsx.ts';
/**
 * Creates a Remix virtual element from a JSX-like call signature.
 *
 * @param type Host tag, component function, or mixin host placeholder.
 * @param props Element props.
 * @param children Child nodes.
 * @returns A Remix virtual element.
 */
export declare function createElement(type: ElementType, props?: Record<string, any>, ...children: any[]): RemixElement;
