import { type Handle, type Props, type RemixNode } from '@remix-run/component';
export declare let accordionChangeEventType: "rmx:accordion-change";
declare global {
    interface HTMLElementEventMap {
        [accordionChangeEventType]: AccordionChangeEvent;
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
type AccordionComponent = typeof AccordionComponentImpl & {
    readonly change: typeof accordionChangeEventType;
};
declare function AccordionComponentImpl(handle: Handle<AccordionContext>): (props: AccordionProps) => import("@remix-run/component").RemixElement;
export declare let Accordion: AccordionComponent;
export declare function AccordionItem(handle: Handle<AccordionItemContext>): (props: AccordionItemProps) => import("@remix-run/component").RemixElement;
export declare function AccordionTrigger(handle: Handle): (props: AccordionTriggerProps) => import("@remix-run/component").RemixElement;
export declare function AccordionContent(handle: Handle): (props: AccordionContentProps) => import("@remix-run/component").RemixElement;
export {};
