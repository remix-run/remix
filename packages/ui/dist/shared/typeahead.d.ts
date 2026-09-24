import { type ElementProps } from '@remix-run/ui';
export type SearchValue = string | string[];
type HiddenTypeaheadHandler = (text: string) => void;
export declare const hiddenTypeahead: import("@remix-run/ui").MixinFactory<HTMLElement, [onTypeahead: HiddenTypeaheadHandler], ElementProps>;
export declare function itemMatchesSearchText<item>(item: item, text: string, getSearchValues: (item: item) => SearchValue): boolean;
export declare function matchNextItemBySearchText<item>(text: string, items: item[], options: {
    fromIndex: number;
    getSearchValues: (item: item) => SearchValue;
}): item | null;
export {};
