import { type Handle, type Props } from '@remix-run/component';
type ListboxContext = {
    disabled: boolean;
    highlightedValue: string | null;
    selectedValue: string | null;
};
export interface ListboxProps extends Props<'button'> {
    initialLabel: string;
}
export interface ListboxOptionProps extends Props<'div'> {
    disabled?: boolean;
    textValue?: string;
    value: string;
}
export declare function Listbox(handle: Handle<ListboxContext>): (props: ListboxProps) => import("@remix-run/component").RemixElement;
export declare function ListboxOption(handle: Handle): (props: ListboxOptionProps) => import("@remix-run/component").RemixElement;
export {};
