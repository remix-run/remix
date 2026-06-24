import type { CSSMixinDescriptor, Handle, Props, RemixNode } from '@remix-run/ui';
import * as tabs from '@remix-run/ui/tabs';
export interface TabsProps {
    children?: RemixNode;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
    orientation?: tabs.TabsOrientation;
    ref?: (ref: tabs.TabsRef) => void;
    value?: string;
}
export type TabsListProps = Props<'div'>;
export type TabProps = Omit<Props<'button'>, 'type'> & {
    children?: RemixNode;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
    value: string;
};
export type TabsPanelProps = Props<'div'> & {
    children?: RemixNode;
    value: string;
};
export declare const listStyle: CSSMixinDescriptor;
export declare const triggerStyle: CSSMixinDescriptor;
export declare function Tabs(handle: Handle<TabsProps>): () => import("@remix-run/ui").RemixElement;
export declare function TabsList(handle: Handle<TabsListProps>): () => import("@remix-run/ui").RemixElement;
export declare function Tab(handle: Handle<TabProps>): () => import("@remix-run/ui").RemixElement;
export declare function TabsPanel(handle: Handle<TabsPanelProps>): () => import("@remix-run/ui").RemixElement;
