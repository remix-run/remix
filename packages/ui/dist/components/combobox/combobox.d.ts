import type { CSSMixinDescriptor, Handle, Props, RemixNode, SearchValue } from '@remix-run/ui';
export interface ComboboxProps extends Omit<Props<'div'>, 'children'> {
    children?: RemixNode;
    defaultValue?: string | null;
    disabled?: boolean;
    inputId?: string;
    name?: string;
    placeholder?: string;
}
export interface ComboboxOptionProps extends Omit<Props<'div'>, 'children'> {
    children?: RemixNode;
    disabled?: boolean;
    label: string;
    searchValue?: SearchValue;
    value: string;
}
export declare const inputStyle: CSSMixinDescriptor;
export declare const popoverStyle: CSSMixinDescriptor;
export declare function Combobox(handle: Handle<ComboboxProps>): () => RemixNode;
export declare function ComboboxOption(handle: Handle<ComboboxOptionProps>): () => RemixNode;
