import { type CSSProps } from './values.ts';
export declare function processStyleClass(styleObj: CSSProps, styleCache: Map<string, {
    selector: string;
    css: string;
}>): {
    selector: string;
    css: string;
};
