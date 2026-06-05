import { type CSSMixinDescriptor, type ElementProps, type Handle, type MixinFactory, type RemixNode } from '@remix-run/ui';
import { type SearchValue } from '../../interactions/typeahead/typeahead-mixin.ts';
export type ListboxValue = string | null;
type NavigationStrategy = 'next' | 'previous' | 'first' | 'last';
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
declare function ListboxProvider(handle: Handle<ListboxProviderProps, ListboxContext>): () => RemixNode;
export interface ListboxOption {
    id: string;
    value: string;
    label: string;
    disabled?: boolean;
    textValue?: SearchValue;
}
export declare const Context: typeof ListboxProvider;
export declare const list: MixinFactory<HTMLElement, [], ElementProps>;
export declare const option: MixinFactory<HTMLElement, [option: Omit<ListboxOption, "id">], ElementProps>;
export {};
