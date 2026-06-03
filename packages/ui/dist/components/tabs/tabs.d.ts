import { type CSSMixinDescriptor, type Dispatched, type ElementProps, type Handle, type Props, type RemixNode } from '@remix-run/ui';
declare const TABS_CHANGE_EVENT: "rmx:tabs-change";
type TabsChangeHandler<target extends HTMLElement> = (event: Dispatched<TabsChangeEvent, target>, signal: AbortSignal) => void | Promise<void>;
export declare const listStyle: CSSMixinDescriptor;
export declare const triggerStyle: CSSMixinDescriptor;
declare global {
    interface HTMLElementEventMap {
        [TABS_CHANGE_EVENT]: TabsChangeEvent;
    }
}
export declare class TabsChangeEvent extends Event {
    readonly previousValue: string | null;
    readonly value: string;
    constructor(value: string, previousValue: string | null);
}
export type TabsOrientation = 'horizontal' | 'vertical';
type TabsDirection = 'first' | 'last' | 'next' | 'previous';
type RegisteredTab = {
    disabled: boolean;
    getNode(): HTMLElement | null;
    value: string;
};
export interface TabsRef {
    readonly selectedValue: string | null;
    focus: (value?: string) => void;
    focusFirst: () => void;
    focusLast: () => void;
    select: (value: string) => void;
}
interface TabsContextValue {
    readonly focusableValue: string | null;
    readonly orientation: TabsOrientation;
    readonly value: string | null;
    getPanelId: (value: string) => string;
    getTriggerId: (value: string) => string;
    move: (fromValue: string, direction: TabsDirection) => void;
    registerTab: (tab: RegisteredTab) => void;
    select: (value: string) => void;
}
export interface TabsContextProps {
    children?: RemixNode;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
    orientation?: TabsOrientation;
    ref?: (ref: TabsRef) => void;
    value?: string;
}
export interface TabsProps extends TabsContextProps {
}
export interface TabsTriggerOptions {
    disabled?: boolean;
    value: string;
}
export interface TabsPanelOptions {
    value: string;
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
declare function TabsProvider(handle: Handle<TabsContextProps, TabsContextValue>): () => RemixNode;
export declare const Context: typeof TabsProvider;
export declare const list: import("@remix-run/ui").MixinFactory<HTMLElement, [], ElementProps>;
export declare const panel: import("@remix-run/ui").MixinFactory<HTMLElement, [options: TabsPanelOptions], ElementProps>;
export declare const trigger: import("@remix-run/ui").MixinFactory<HTMLElement, [options: TabsTriggerOptions], ElementProps>;
export declare function onTabsChange<target extends HTMLElement>(handler: TabsChangeHandler<target>, captureBoolean?: boolean): import("@remix-run/ui").MixinDescriptor<target, ["rmx:tabs-change", (event: import("../../runtime/event-listeners.ts").EnsureEvent<import("../../runtime/event-listeners.ts").EventMap<target>["rmx:tabs-change"], target>, signal: AbortSignal) => void | Promise<void>, (boolean | undefined)?], ElementProps>;
export declare function Tabs(handle: Handle<TabsProps>): () => import("@remix-run/ui").RemixElement;
export declare function TabsList(handle: Handle<TabsListProps>): () => import("@remix-run/ui").RemixElement;
export declare function Tab(handle: Handle<TabProps>): () => import("@remix-run/ui").RemixElement;
export declare function TabsPanel(handle: Handle<TabsPanelProps>): () => import("@remix-run/ui").RemixElement;
export {};
