import { type CSSMixinDescriptor, type ElementProps, type Handle, type Props, type RemixNode } from '@remix-run/component';
import * as listbox from '../listbox/listbox.ts';
import { type SearchValue } from '../typeahead/typeahead-mixin.ts';
declare const COMBOBOX_CHANGE_EVENT: "rmx:combobox-change";
type ComboboxChangeHandler = (event: ComboboxChangeEvent, signal: AbortSignal) => void | Promise<void>;
type ShowReason = 'hint' | 'nav';
export declare const inputStyle: CSSMixinDescriptor;
export declare const popoverStyle: CSSMixinDescriptor;
declare global {
    interface HTMLElementEventMap {
        [COMBOBOX_CHANGE_EVENT]: ComboboxChangeEvent;
    }
}
export declare class ComboboxChangeEvent extends Event {
    readonly label: string | null;
    readonly optionId: string | null;
    readonly value: string | null;
    constructor({ label, optionId, value, }: {
        label: string | null;
        optionId: string | null;
        value: string | null;
    });
}
export type ComboboxOpenStrategy = 'selected' | 'selected-or-none' | 'first' | 'last';
export interface ComboboxHandle {
    readonly activeOptionId: string | null;
    readonly id: string;
    readonly inputText: string;
    readonly isOpen: boolean;
    readonly label: string | null;
    readonly value: string | null;
    close: () => void;
    open: (strategy?: ComboboxOpenStrategy) => Promise<void>;
}
export interface ComboboxContextProps {
    children?: RemixNode;
    defaultValue?: string | null;
    disabled?: boolean;
    name?: string;
    ref?: (handle: ComboboxHandle) => void;
}
export interface ComboboxProps extends Omit<Props<'div'>, 'children'> {
    children?: RemixNode;
    defaultValue?: string | null;
    disabled?: boolean;
    inputId?: string;
    name?: string;
    placeholder?: string;
}
export interface ComboboxOptionOptions {
    disabled?: boolean;
    label: string;
    searchValue?: SearchValue;
    value: string;
}
export interface ComboboxOptionProps extends Omit<Props<'div'>, 'children'> {
    children?: RemixNode;
    disabled?: boolean;
    label: string;
    searchValue?: SearchValue;
    value: string;
}
interface ComboboxContextValue {
    readonly activeId: string | undefined;
    readonly disabled: boolean;
    readonly filterText: string;
    readonly inputText: string;
    readonly isOpen: boolean;
    readonly listId: string;
    readonly name: string | undefined;
    readonly showReason: ShowReason;
    readonly surfaceVisible: boolean;
    readonly value: listbox.ListboxValue;
    clearInputSelection: () => void;
    close: () => void;
    handleBlur: () => void;
    handleEscape: () => void;
    navigateNext: () => void;
    navigatePrevious: () => void;
    open: (strategy?: ComboboxOpenStrategy) => Promise<void>;
    openFromArrow: (direction: 'first' | 'last') => Promise<void>;
    openFromInputActivation: () => Promise<void>;
    registerInput: (node: HTMLInputElement) => void;
    registerSurface: (node: HTMLElement) => void;
    setInputText: (text: string) => Promise<void>;
    syncPopoverMinWidth: () => void;
    selectActive: () => Promise<void>;
    unregisterInput: (node: HTMLInputElement) => void;
    unregisterSurface: (node: HTMLElement) => void;
}
declare function ComboboxProvider(handle: Handle<ComboboxContextValue>): (nextProps: ComboboxContextProps) => import("@remix-run/component").RemixElement;
declare const popoverMixin: <boundNode extends HTMLElement = HTMLElement>() => import("@remix-run/component").MixinDescriptor<boundNode, [], ElementProps>;
export declare const Context: typeof ComboboxProvider;
export declare const hiddenInput: <boundNode extends HTMLInputElement = HTMLInputElement>() => import("@remix-run/component").MixinDescriptor<boundNode, [], ElementProps>;
export declare const input: <boundNode extends HTMLInputElement = HTMLInputElement>() => import("@remix-run/component").MixinDescriptor<boundNode, [], ElementProps>;
export declare const list: <boundNode extends HTMLElement = HTMLElement>() => import("@remix-run/component").MixinDescriptor<boundNode, [], ElementProps>;
export declare const option: <boundNode extends HTMLElement = HTMLElement>(options: ComboboxOptionOptions) => import("@remix-run/component").MixinDescriptor<boundNode, [options: ComboboxOptionOptions], ElementProps>;
export { popoverMixin as popover };
export declare function onComboboxChange(handler: ComboboxChangeHandler, captureBoolean?: boolean): import("@remix-run/component").MixinDescriptor<HTMLElement, ["rmx:combobox-change", (event: import("@remix-run/component").Dispatched<ComboboxChangeEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, (boolean | undefined)?], ElementProps>;
export declare function Combobox(): (props: ComboboxProps) => import("@remix-run/component").RemixElement;
export declare function ComboboxOption(): (props: ComboboxOptionProps) => import("@remix-run/component").RemixElement;
