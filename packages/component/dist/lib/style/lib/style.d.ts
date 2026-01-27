export type DOMStyleProperties = {
    [key in keyof Omit<CSSStyleDeclaration, 'item' | 'setProperty' | 'removeProperty' | 'getPropertyValue' | 'getPropertyPriority'>]?: string | number | null | undefined;
};
export type AllStyleProperties = {
    [key: string]: string | number | null | undefined;
};
export interface StyleProps extends AllStyleProperties, DOMStyleProperties {
    cssText?: string | null;
}
export interface CSSProps extends DOMStyleProperties {
    [key: string]: CSSProps | string | number | null | undefined;
}
export declare function normalizeCssValue(key: string, value: unknown): string;
export declare function processStyle(styleObj: CSSProps, styleCache: Map<string, {
    className: string;
    css: string;
}>): {
    className: string;
    css: string;
};
export declare function clearStyleCache(styleCache: Map<string, {
    className: string;
    css: string;
}>): void;
