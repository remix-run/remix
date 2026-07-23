import { type CSSMixinDescriptor, type Handle, type Props, type RemixNode } from '@remix-run/ui';
import * as accordion from '@remix-run/ui/accordion/primitives';
type AccordionBaseProps = Omit<Props<'div'>, 'children'> & {
    children?: RemixNode;
    disabled?: boolean;
    headingLevel?: accordion.AccordionHeadingLevel;
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
export declare const rootStyle: CSSMixinDescriptor;
export declare const itemStyle: CSSMixinDescriptor;
export declare const headingStyle: CSSMixinDescriptor;
export declare const triggerStyle: CSSMixinDescriptor;
export declare const indicatorStyle: CSSMixinDescriptor;
export declare const panelStyle: CSSMixinDescriptor;
export declare const bodyStyle: CSSMixinDescriptor;
export declare function Accordion(handle: Handle<AccordionProps>): () => RemixNode;
export declare function AccordionItem(handle: Handle<AccordionItemProps>): () => RemixNode;
export declare function AccordionTrigger(handle: Handle<AccordionTriggerProps>): () => RemixNode;
export declare function AccordionContent(handle: Handle<AccordionContentProps>): () => RemixNode;
export {};
