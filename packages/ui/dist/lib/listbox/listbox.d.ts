import { type CSSMixinDescriptor, type Handle, type RemixNode } from '@remix-run/component';
import { type SearchValue } from '../typeahead/typeahead-mixin.ts';
export type ListboxValue = string | null;
declare enum NavigationStrategy {
    Next = 0,
    Previous = 1,
    First = 2,
    Last = 3
}
interface Values {
    value: ListboxValue;
    activeValue: ListboxValue;
}
export interface ListboxContext extends Values {
    registerOption: (option: RegisteredOption) => void;
    select: (value: ListboxValue) => Promise<void>;
    highlight: (value: ListboxValue) => void;
    highlightSearchMatch: (text: string) => void;
    navigate: (direction: NavigationStrategy) => void;
    scrollActiveOptionIntoView: () => void;
}
export interface ListboxProviderProps extends Values {
    children?: RemixNode;
    ref?: (ref: ListboxRef) => void;
    flashSelection?: boolean;
    selectionFlashAttribute?: string;
    onSelect: (value: ListboxValue, option?: ListboxRegisteredOption) => void;
    onSelectSettled?: (value: ListboxValue, option?: ListboxRegisteredOption) => void | Promise<void>;
    onHighlight: (value: ListboxValue, option?: ListboxRegisteredOption) => void;
}
export interface ListboxRef {
    active: ListboxRegisteredOption | undefined;
    options: ReadonlyArray<ListboxRegisteredOption>;
    selected: ListboxRegisteredOption | undefined;
    highlight: (value: ListboxValue) => void;
    highlightSearchMatch: (text: string) => void;
    matchSearchText: (text: string, fromValue?: ListboxValue) => ListboxRegisteredOption | null;
    navigateFirst: () => void;
    navigateLast: () => void;
    navigateNext: () => void;
    navigatePrevious: () => void;
    scrollActiveOptionIntoView: () => void;
    select: (value: ListboxValue) => Promise<void>;
    selectActive: () => Promise<void>;
}
export interface ListboxRegisteredOption extends ListboxOption {
    readonly hidden: boolean;
    readonly node: HTMLElement;
}
interface RegisteredOption extends ListboxRegisteredOption {
}
export declare const listStyle: CSSMixinDescriptor;
export declare const optionStyle: CSSMixinDescriptor;
export declare const glyphStyle: CSSMixinDescriptor;
export declare const labelStyle: CSSMixinDescriptor;
declare function ListboxProvider(handle: Handle<ListboxContext>): (nextProps: ListboxProviderProps) => RemixNode;
export interface ListboxOption {
    id: string;
    value: string;
    label: string;
    disabled?: boolean;
    textValue?: SearchValue;
}
export declare const Context: typeof ListboxProvider;
export declare const list: <boundNode extends HTMLElement = HTMLElement>() => import("@remix-run/component").MixinDescriptor<boundNode, [], import("@remix-run/component").ElementProps>;
export declare const option: <boundNode extends HTMLElement = HTMLElement>(option: Omit<ListboxOption, "id">) => import("@remix-run/component").MixinDescriptor<boundNode, [option: Omit<ListboxOption, "id">], import("@remix-run/component").ElementProps>;
export {};
