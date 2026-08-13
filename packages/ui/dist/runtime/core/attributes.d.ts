import type { ElementProps } from '../jsx.ts';
export declare const FRAMEWORK_PROPS: Set<string>;
export declare const SELF_CLOSING_TAGS: Set<string>;
export declare function isChildlessElement(name: string): boolean;
export declare function canUseProperty(element: Element, name: string, isSvg: boolean, attr: string): element is Element & Record<string, unknown>;
export declare function normalizeAttributeName(name: string, isSvg: boolean): {
    ns?: string;
    attr: string;
};
export declare function isBooleanishStringAttribute(name: string): boolean;
export declare function shouldStringifyBooleanAttribute(name: string): boolean;
export declare function serializeStyleObject(style: Record<string, unknown>): string;
export declare function getMergedClassName(props: ElementProps): string | undefined;
export declare function toKebabCase(value: string): string;
