import { type CSSMixinDescriptor, type ElementProps, type Handle, type Props, type RemixNode } from '@remix-run/component';
declare const TABS_CHANGE_EVENT: "rmx:tabs-change";
type TabsChangeHandler = (event: TabsChangeEvent, signal: AbortSignal) => void | Promise<void>;
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
declare function TabsProvider(handle: Handle<TabsContextValue>): (nextProps: TabsContextProps) => RemixNode;
export declare const Context: typeof TabsProvider;
export declare const list: <boundNode extends HTMLElement = HTMLElement>() => import("@remix-run/component").MixinDescriptor<boundNode, [], ElementProps>;
export declare const panel: <boundNode extends HTMLElement = HTMLElement>(options: TabsPanelOptions) => import("@remix-run/component").MixinDescriptor<boundNode, [options: TabsPanelOptions], ElementProps>;
export declare const trigger: <boundNode extends HTMLElement = HTMLElement>(options: TabsTriggerOptions) => import("@remix-run/component").MixinDescriptor<boundNode, [options: TabsTriggerOptions], ElementProps>;
export declare function onTabsChange(handler: TabsChangeHandler, captureBoolean?: boolean): import("@remix-run/component").MixinDescriptor<HTMLElement, ["rmx:tabs-change", (event: import("@remix-run/component").Dispatched<TabsChangeEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, (boolean | undefined)?], ElementProps>;
export declare function Tabs(): (props: TabsProps) => import("@remix-run/component").RemixElement;
export declare function TabsList(): (props: TabsListProps) => import("@remix-run/component").RemixElement;
export declare function Tab(): (props: TabProps) => import("@remix-run/component").RemixElement;
export declare function TabsPanel(): (props: TabsPanelProps) => import("@remix-run/component").RemixElement;
export {};
