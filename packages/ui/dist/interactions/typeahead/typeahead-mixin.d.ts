import { type ElementProps } from '@remix-run/ui';
export type SearchValue = string | string[];
export declare const hiddenTypeahead: <boundNode extends HTMLElement = HTMLElement>(onTypeahead: (text: string) => void) => import("@remix-run/ui").MixinDescriptor<boundNode, [onTypeahead: (text: string) => void], ElementProps>;
export declare function itemMatchesSearchText<item>(item: item, text: string, getSearchValues: (item: item) => SearchValue): boolean;
export declare function matchNextItemBySearchText<item>(text: string, items: item[], options: {
    fromIndex: number;
    getSearchValues: (item: item) => SearchValue;
}): item | null;
