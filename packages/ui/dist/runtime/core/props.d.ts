import type { ElementProps } from '../jsx.ts';
/**
 * Patches DOM attributes and selected properties from old props to new props.
 *
 * @param curr Previous host props.
 * @param next Next host props.
 * @param dom Element to patch.
 */
export declare function patchHostProps(curr: ElementProps, next: ElementProps, dom: Element): void;
