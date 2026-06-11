import { on, type CSSMixinDescriptor, type Dispatched, type ElementProps, type Handle, type MixinFactory, type Props, type RemixNode } from '@remix-run/ui';
import * as listbox from '../listbox/listbox.ts';
import * as popover from '../popover/popover.ts';
declare const SELECT_CHANGE_EVENT: "rmx:select-change";
type SelectChangeHandler<target extends HTMLElement> = (event: Dispatched<SelectChangeEvent, target>, signal: AbortSignal) => void | Promise<void>;
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
declare function SelectProvider(handle: Handle<SelectContextProps, SelectContextValue>): () => RemixNode;
declare const popoverMixin: MixinFactory<HTMLElement, [], ElementProps>;
export declare const triggerStyle: CSSMixinDescriptor;
export declare const Context: typeof SelectProvider;
export declare const hiddenInput: MixinFactory<HTMLInputElement, [], ElementProps>;
export declare const list: MixinFactory<HTMLElement, [], ElementProps>;
export declare const option: MixinFactory<HTMLElement, [option: Omit<listbox.ListboxOption, "id">], ElementProps>;
export { popoverMixin as popover };
export declare const trigger: MixinFactory<HTMLButtonElement, [], ElementProps>;
export declare function onSelectChange<target extends HTMLElement>(handler: SelectChangeHandler<target>, captureBoolean?: boolean): ReturnType<typeof on<target, typeof SELECT_CHANGE_EVENT>>;
export declare function Select(handle: Handle<SelectProps>): () => RemixNode;
export declare function Option(handle: Handle<SelectOptionProps>): () => RemixNode;
