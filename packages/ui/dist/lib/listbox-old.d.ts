import { type Handle, type Props, type RemixNode } from '@remix-run/component';
export declare let listboxChangeEventType: "rmx:listbox-change";
export declare let listboxOpenChangeEventType: "rmx:listbox-open-change";
declare global {
    interface ElementEventMap {
        [listboxChangeEventType]: ListboxChangeEvent;
        [listboxOpenChangeEventType]: ListboxOpenChangeEvent;
    }
    interface HTMLElementEventMap {
        [listboxChangeEventType]: ListboxChangeEvent;
        [listboxOpenChangeEventType]: ListboxOpenChangeEvent;
    }
}
export declare class ListboxChangeEvent extends Event {
    itemValue: string | null;
    value: string | null;
    constructor(value: string | null, itemValue: string | null);
}
export declare class ListboxOpenChangeEvent extends Event {
    open: boolean;
    constructor(open: boolean);
}
export type ListboxProps = Omit<Props<'div'>, 'children'> & {
    children?: RemixNode;
    defaultValue?: string | null;
    defaultOpen?: boolean;
    disabled?: boolean;
    loopFocus?: boolean;
    name?: string;
    open?: boolean;
    value?: string | null;
};
export type ListboxOptionProps = Omit<Props<'div'>, 'children'> & {
    children?: RemixNode;
    disabled?: boolean;
    textValue?: string;
    value: string;
};
type ListboxComponent = typeof ListboxImpl & {
    readonly change: typeof listboxChangeEventType;
    readonly openChange: typeof listboxOpenChangeEventType;
};
type ListboxOptionComponent = typeof ListboxOptionImpl;
declare function ListboxOptionImpl(): (props: ListboxOptionProps) => import("@remix-run/component").RemixElement;
declare function ListboxImpl(handle: Handle): (props: ListboxProps) => import("@remix-run/component").RemixElement;
export declare let Listbox: ListboxComponent;
export declare let ListboxOption: ListboxOptionComponent;
export {};
