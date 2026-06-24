import type { CSSMixinDescriptor, Handle, Props, RemixNode, SearchValue } from '@remix-run/ui';
export interface SelectProps extends Omit<Props<'button'>, 'children' | 'name'> {
    children?: RemixNode;
    defaultLabel: string;
    defaultValue?: string | null;
    disabled?: boolean;
    name?: string;
}
export type SelectOptionProps = Props<'div'> & {
    children?: RemixNode;
    disabled?: boolean;
    label: string;
    textValue?: SearchValue;
    value: string;
};
export declare const triggerStyle: CSSMixinDescriptor;
export declare function Select(handle: Handle<SelectProps>): () => RemixNode;
export declare function Option(handle: Handle<SelectOptionProps>): () => RemixNode;
