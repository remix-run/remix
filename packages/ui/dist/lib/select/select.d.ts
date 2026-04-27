import { type CSSMixinDescriptor, type ElementProps, type Handle, type Props, type RemixNode } from '@remix-run/component';
import * as listbox from '../listbox/listbox.ts';
import * as popover from '../popover/popover.ts';
declare const SELECT_CHANGE_EVENT: "rmx:select-change";
type SelectChangeHandler = (event: SelectChangeEvent, signal: AbortSignal) => void | Promise<void>;
declare global {
    interface HTMLElementEventMap {
        [SELECT_CHANGE_EVENT]: SelectChangeEvent;
    }
}
export declare class SelectChangeEvent extends Event {
    readonly label: string | null;
    readonly optionId: string | null;
    readonly value: string | null;
    constructor({ label, optionId, value, }: {
        label: string | null;
        optionId: string | null;
        value: string | null;
    });
}
export interface SelectContextProps {
    children?: RemixNode;
    defaultLabel: string;
    defaultValue?: string | null;
    disabled?: boolean;
    name?: string;
}
export interface SelectProps extends Omit<Props<'button'>, 'children' | 'name'> {
    children?: RemixNode;
    defaultLabel: string;
    defaultValue?: string | null;
    name?: string;
}
export type SelectOptionProps = Props<'div'> & Omit<listbox.ListboxOption, 'id'>;
interface SelectContextValue {
    readonly activeId: string | undefined;
    readonly disabled: boolean;
    readonly displayedLabel: string;
    readonly isExpanded: boolean;
    readonly isOpen: boolean;
    readonly listId: string;
    readonly name: string | undefined;
    readonly selectedId: string | undefined;
    readonly value: listbox.ListboxValue;
    close: () => void;
    open: () => void;
    registerPopoverContext: (context: popover.PopoverContext) => void;
    registerSurface: (node: HTMLElement) => void;
    registerTrigger: (node: HTMLButtonElement) => void;
    selectTypeaheadMatch: (text: string) => void;
    syncPopoverMinWidth: () => void;
    unregisterPopoverContext: (context: popover.PopoverContext) => void;
    unregisterSurface: (node: HTMLElement) => void;
    unregisterTrigger: (node: HTMLButtonElement) => void;
}
declare function SelectProvider(handle: Handle<SelectContextValue>): (nextProps: SelectContextProps) => import("@remix-run/component").RemixElement;
declare const popoverMixin: <boundNode extends HTMLElement = HTMLElement>() => import("@remix-run/component").MixinDescriptor<boundNode, [], ElementProps>;
export declare const triggerStyle: CSSMixinDescriptor;
export declare const Context: typeof SelectProvider;
export declare const hiddenInput: <boundNode extends HTMLInputElement = HTMLInputElement>() => import("@remix-run/component").MixinDescriptor<boundNode, [], ElementProps>;
export declare const list: <boundNode extends HTMLElement = HTMLElement>() => import("@remix-run/component").MixinDescriptor<boundNode, [], ElementProps>;
export declare const option: <boundNode extends HTMLElement = HTMLElement>(option: Omit<listbox.ListboxOption, "id">) => import("@remix-run/component").MixinDescriptor<boundNode, [option: Omit<listbox.ListboxOption, "id">], ElementProps>;
export { popoverMixin as popover };
export declare const trigger: <boundNode extends HTMLButtonElement = HTMLButtonElement>() => import("@remix-run/component").MixinDescriptor<boundNode, [], ElementProps>;
export declare function onSelectChange(handler: SelectChangeHandler, captureBoolean?: boolean): import("@remix-run/component").MixinDescriptor<HTMLElement, ["rmx:select-change", (event: import("@remix-run/component").Dispatched<SelectChangeEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, (boolean | undefined)?], ElementProps>;
export declare function Select(): (props: SelectProps) => import("@remix-run/component").RemixElement;
export declare function Option(): (props: SelectOptionProps) => import("@remix-run/component").RemixElement;
