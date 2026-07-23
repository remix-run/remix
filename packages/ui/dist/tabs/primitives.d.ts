import { on, type Dispatched, type ElementProps, type Handle, type MixinFactory, type RemixNode } from '@remix-run/ui';
declare const TABS_CHANGE_EVENT: "rmx:tabs-change";
type TabsChangeHandler<target extends HTMLElement> = (event: Dispatched<TabsChangeEvent, target>, signal: AbortSignal) => void | Promise<void>;
export type TabsActivationDirection = 'first' | 'last' | 'next' | 'previous';
export interface TabsRegisteredTab {
    disabled: boolean;
    getTabNode(): HTMLButtonElement | null;
    name: string;
}
export interface TabsContextValue {
    readonly activeTab: string | null;
    readonly disabled: boolean;
    activateTab(name: string): void;
    activateTabInDirection(name: string, direction: TabsActivationDirection): void;
    getPanelId(name: string): string;
    getTabId(name: string): string;
    isActiveTab(name: string): boolean;
    registerRoot(node: HTMLElement): void;
    registerTab(tab: TabsRegisteredTab): void;
    unregisterRoot(node: HTMLElement): void;
}
export interface TabsContextProps {
    activeTab?: string;
    children?: RemixNode;
    defaultActiveTab?: string;
    disabled?: boolean;
    onActiveTabChange?: (activeTab: string) => void;
}
export interface TabsRootOptions {
}
export interface TabListOptions {
}
export interface TabOptions {
    disabled?: boolean;
    name: string;
}
export interface TabPanelOptions {
    name: string;
}
export declare class TabsChangeEvent extends Event {
    readonly activeTab: string;
    readonly previousActiveTab: string | null;
    constructor(activeTab: string, previousActiveTab: string | null);
}
declare global {
    interface HTMLElementEventMap {
        [TABS_CHANGE_EVENT]: TabsChangeEvent;
    }
}
declare function TabsProvider(handle: Handle<TabsContextProps, TabsContextValue>): () => RemixNode;
export declare const Context: typeof TabsProvider;
export declare const list: MixinFactory<HTMLElement, [options?: TabListOptions | undefined], ElementProps>;
export declare const panel: MixinFactory<HTMLElement, [options: TabPanelOptions], ElementProps>;
export declare const root: MixinFactory<HTMLElement, [options?: TabsRootOptions | undefined], ElementProps>;
export declare const tab: MixinFactory<HTMLButtonElement, [options: TabOptions], ElementProps>;
export declare function onTabsChange<target extends HTMLElement>(handler: TabsChangeHandler<target>, captureBoolean?: boolean): ReturnType<typeof on<target, typeof TABS_CHANGE_EVENT>>;
export {};
