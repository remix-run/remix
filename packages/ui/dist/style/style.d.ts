import { type CSSProps } from './properties.ts';
export declare function processStyleClass(styleObj: CSSProps, styleCache: Map<string, {
    selector: string;
    css: string;
}>): {
    selector: string;
    css: string;
};
