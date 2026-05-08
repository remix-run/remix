import { type CSSMixinDescriptor, type Handle, type Props, type RemixNode } from '@remix-run/ui';
declare const ACCORDION_CHANGE_EVENT: "rmx:accordion-change";
type AccordionChangeHandler = (event: AccordionChangeEvent, signal: AbortSignal) => void | Promise<void>;
declare global {
    interface HTMLElementEventMap {
        [ACCORDION_CHANGE_EVENT]: AccordionChangeEvent;
    }
}
export declare class AccordionChangeEvent extends Event {
    accordionType: AccordionType;
    itemValue: string;
    value: string | null | string[];
    constructor(value: string | null | string[], init: {
        accordionType: AccordionType;
        itemValue: string;
    });
}
type AccordionType = 'single' | 'multiple';
type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
type AccordionBaseProps = Omit<Props<'div'>, 'children'> & {
    children?: RemixNode;
    disabled?: boolean;
    headingLevel?: HeadingLevel;
};
export type AccordionSingleProps = AccordionBaseProps & {
    type?: 'single';
    value?: string | null;
    defaultValue?: string | null;
    onValueChange?: (value: string | null) => void;
    collapsible?: boolean;
};
export type AccordionMultipleProps = AccordionBaseProps & {
    type: 'multiple';
    value?: string[];
    defaultValue?: string[];
    onValueChange?: (value: string[]) => void;
};
export type AccordionProps = AccordionSingleProps | AccordionMultipleProps;
export type AccordionItemProps = Omit<Props<'div'>, 'children'> & {
    children?: RemixNode;
    disabled?: boolean;
    value: string;
};
export type AccordionTriggerProps = Omit<Props<'button'>, 'children' | 'type'> & {
    children?: RemixNode;
    indicator?: RemixNode | null;
    type?: 'button' | 'submit' | 'reset';
};
export type AccordionContentProps = Omit<Props<'div'>, 'children'> & {
    children?: RemixNode;
};
type RegisteredItem = {
    disabled: boolean;
    getTriggerNode(): HTMLButtonElement | null;
    value: string;
};
type AccordionContext = {
    collapsible: boolean;
    disabled: boolean;
    focusItem(value: string, direction: FocusDirection): void;
    getPanelId(value: string): string | undefined;
    getTriggerId(value: string): string | undefined;
    headingLevel: HeadingLevel;
    isOpen(value: string): boolean;
    registerItem(item: RegisteredItem): void;
    toggleItem(value: string): void;
    type: AccordionType;
};
type AccordionItemContext = {
    disabled: boolean;
    headingLevel: HeadingLevel;
    lockedOpen: boolean;
    open: boolean;
    panelId: string;
    setTriggerNode(node: HTMLButtonElement | null): void;
    triggerId: string;
    value: string;
};
type FocusDirection = 'first' | 'last' | 'next' | 'previous';
export declare const rootStyle: CSSMixinDescriptor;
export declare const itemStyle: CSSMixinDescriptor;
export declare const triggerStyle: CSSMixinDescriptor;
export declare const indicatorStyle: CSSMixinDescriptor;
export declare const panelStyle: CSSMixinDescriptor;
export declare const bodyStyle: CSSMixinDescriptor;
declare function AccordionImpl(handle: Handle<AccordionProps, AccordionContext>): () => import("@remix-run/ui").RemixElement;
export declare function onAccordionChange(handler: AccordionChangeHandler, captureBoolean?: boolean): import("@remix-run/ui").MixinDescriptor<HTMLElement, ["rmx:accordion-change", (event: import("@remix-run/ui").Dispatched<AccordionChangeEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, (boolean | undefined)?], import("@remix-run/ui").ElementProps>;
export declare const Accordion: typeof AccordionImpl;
export declare function AccordionItem(handle: Handle<AccordionItemProps, AccordionItemContext>): () => import("@remix-run/ui").RemixElement;
export declare function AccordionTrigger(handle: Handle<AccordionTriggerProps>): () => import("@remix-run/ui").RemixElement;
export declare function AccordionContent(handle: Handle<AccordionContentProps>): () => import("@remix-run/ui").RemixElement;
export {};
