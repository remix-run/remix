import { type CSSMixinDescriptor, type Handle, type Props, type RemixNode } from '@remix-run/ui';
export { TabsChangeEvent, onTabsChange } from '@remix-run/ui/tabs/primitives';
export type TabsSize = 'md' | 'lg';
export interface TabsProps extends Omit<Props<'div'>, 'children'> {
    activeTab?: string;
    children?: RemixNode;
    defaultActiveTab?: string;
    disabled?: boolean;
    onActiveTabChange?: (activeTab: string) => void;
    size?: TabsSize;
}
export interface TabListProps extends Omit<Props<'div'>, 'children'> {
    children?: RemixNode;
}
export interface TabProps extends Omit<Props<'button'>, 'children' | 'type'> {
    children?: RemixNode;
    disabled?: boolean;
    name: string;
    type?: 'button' | 'submit' | 'reset';
}
export interface TabPanelProps extends Omit<Props<'div'>, 'children'> {
    children?: RemixNode;
    name: string;
}
export declare const rootStyle: CSSMixinDescriptor;
export declare const listStyle: CSSMixinDescriptor;
export declare const tabStyle: CSSMixinDescriptor;
export declare const panelStyle: CSSMixinDescriptor;
export declare function Tabs(handle: Handle<TabsProps>): () => RemixNode;
export declare function TabList(handle: Handle<TabListProps>): () => RemixNode;
export declare function Tab(handle: Handle<TabProps>): () => RemixNode;
export declare function TabPanel(handle: Handle<TabPanelProps>): () => RemixNode;
