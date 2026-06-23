import { on, type Dispatched, type ElementProps, type Handle, type Props, type RemixNode } from '@remix-run/ui';
declare const ACCORDION_CHANGE_EVENT: "rmx:accordion-change";
type AccordionChangeHandler<target extends HTMLElement> = (event: Dispatched<AccordionChangeEvent, target>, signal: AbortSignal) => void | Promise<void>;
declare global {
    interface HTMLElementEventMap {
        [ACCORDION_CHANGE_EVENT]: AccordionChangeEvent;
    }
}
export declare class AccordionChangeEvent extends Event {
    readonly accordionType: AccordionType;
    readonly itemValue: string;
    readonly value: AccordionValue;
    constructor(value: AccordionValue, init: {
        accordionType: AccordionType;
        itemValue: string;
    });
}
export type AccordionType = 'single' | 'multiple';
export type AccordionValue = string | null | string[];
export type AccordionSingleValue = string | null;
export type AccordionMultipleValue = string[];
export type AccordionHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
type FocusDirection = 'first' | 'last' | 'next' | 'previous';
type RegisteredItem = {
    disabled: boolean;
    getTriggerNode(): HTMLButtonElement | null;
    value: string;
};
interface AccordionContextValue {
    readonly collapsible: boolean;
    readonly disabled: boolean;
    readonly headingLevel: AccordionHeadingLevel;
    readonly type: AccordionType;
    focusItem(value: string, direction: FocusDirection): void;
    getPanelId(value: string): string;
    getTriggerId(value: string): string | undefined;
    isOpen(value: string): boolean;
    registerItem(item: RegisteredItem): void;
    registerRoot(node: HTMLElement): void;
    toggleItem(value: string): void;
    unregisterRoot(node: HTMLElement): void;
}
interface AccordionItemContextValue {
    readonly disabled: boolean;
    readonly headingLevel: AccordionHeadingLevel;
    readonly lockedOpen: boolean;
    readonly open: boolean;
    readonly panelId: string;
    readonly triggerId: string;
    readonly value: string;
    setTriggerNode(node: HTMLButtonElement | null): void;
}
export interface AccordionBaseContextProps {
    children?: RemixNode;
    disabled?: boolean;
    headingLevel?: AccordionHeadingLevel;
}
export interface AccordionSingleContextProps extends AccordionBaseContextProps {
    type?: 'single';
    value?: AccordionSingleValue;
    defaultValue?: AccordionSingleValue;
    onValueChange?: (value: AccordionSingleValue) => void;
    collapsible?: boolean;
}
export interface AccordionMultipleContextProps extends AccordionBaseContextProps {
    type: 'multiple';
    value?: AccordionMultipleValue;
    defaultValue?: AccordionMultipleValue;
    onValueChange?: (value: AccordionMultipleValue) => void;
}
export type AccordionContextProps = AccordionSingleContextProps | AccordionMultipleContextProps;
export interface AccordionRootOptions {
}
export interface AccordionItemOptions {
    disabled?: boolean;
    value: string;
}
export interface AccordionTriggerOptions {
    disabled?: boolean;
}
export interface AccordionContentOptions {
}
export type AccordionProps = Props<'div'> & AccordionContextProps;
export type AccordionItemProps = Omit<Props<'div'>, 'children'> & AccordionItemOptions & {
    children?: RemixNode;
};
export type AccordionTriggerProps = Omit<Props<'button'>, 'children' | 'type'> & AccordionTriggerOptions & {
    children?: RemixNode;
    type?: 'button' | 'submit' | 'reset';
};
export type AccordionContentProps = Omit<Props<'div'>, 'children'> & {
    children?: RemixNode;
};
declare function AccordionProvider(handle: Handle<AccordionContextProps, AccordionContextValue>): () => RemixNode;
export declare const Context: typeof AccordionProvider;
export declare const ItemContext: (handle: Handle<AccordionItemOptions & {
    children?: RemixNode;
}, AccordionItemContextValue>) => () => RemixNode;
export declare const content: import("@remix-run/ui").MixinFactory<HTMLElement, [options?: AccordionContentOptions | undefined], ElementProps>;
export declare const item: import("@remix-run/ui").MixinFactory<HTMLElement, [options?: AccordionItemOptions | undefined], ElementProps>;
export declare const root: import("@remix-run/ui").MixinFactory<HTMLElement, [options?: AccordionRootOptions | undefined], ElementProps>;
export declare const trigger: import("@remix-run/ui").MixinFactory<HTMLButtonElement, [options?: AccordionTriggerOptions | undefined], ElementProps>;
export declare function onAccordionChange<target extends HTMLElement>(handler: AccordionChangeHandler<target>, captureBoolean?: boolean): ReturnType<typeof on<target, typeof ACCORDION_CHANGE_EVENT>>;
export {};
