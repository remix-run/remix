import { type CSSMixinDescriptor, type ElementProps, type Handle, type Props, type RemixNode } from '@remix-run/ui';
import { type AnchorOptions } from '../anchor/anchor.ts';
import { type SearchValue } from '../../interactions/typeahead/typeahead-mixin.ts';
declare const MENU_SELECT_EVENT: "rmx:menu-select";
type MenuSelectHandler = (event: MenuSelectEvent, signal: AbortSignal) => void | Promise<void>;
export declare const buttonStyle: CSSMixinDescriptor;
export declare const popoverStyle: CSSMixinDescriptor;
export declare const listStyle: CSSMixinDescriptor;
export declare const itemStyle: CSSMixinDescriptor;
export declare const itemSlotStyle: CSSMixinDescriptor;
export declare const itemLabelStyle: CSSMixinDescriptor;
export declare const itemGlyphStyle: CSSMixinDescriptor;
export declare const triggerGlyphStyle: CSSMixinDescriptor;
declare global {
    interface HTMLElementEventMap {
        [MENU_SELECT_EVENT]: MenuSelectEvent;
    }
}
type MenuItemType = 'item' | 'checkbox' | 'radio';
type CloseAnimation = 'fade' | 'none';
type OpenStrategy = 'first' | 'last' | 'list' | 'none';
declare enum NavigationStrategy {
    Next = 0,
    Previous = 1,
    First = 2,
    Last = 3
}
declare enum State {
    Idle = "idle",
    Dismissing = "dismissing",
    Selecting = "selecting"
}
export interface MenuSelectItem {
    checked?: boolean;
    id: string;
    label: string;
    name: string;
    type: MenuItemType;
    value: string | null;
}
export declare class MenuSelectEvent extends Event {
    readonly item: MenuSelectItem;
    constructor(item: MenuSelectItem);
}
export interface MenuProviderProps {
    children?: RemixNode;
    label?: string;
}
export interface MenuTriggerOptions extends AnchorOptions {
}
export interface MenuItemOptions {
    checked?: boolean;
    disabled?: boolean;
    label?: string;
    name: string;
    searchValue?: SearchValue;
    type?: Exclude<MenuItemType, 'item'>;
    value?: string;
}
export interface SubmenuTriggerOptions {
    disabled?: boolean;
    label?: string;
    searchValue?: SearchValue;
    value?: string;
}
type OpenMenuOptions = {
    focus?: boolean;
    strategy?: OpenStrategy;
};
type CloseBranchOptions = {
    focusTrigger?: boolean;
};
type CloseAllOptions = {
    focusRoot?: boolean;
};
type CloseSyncOptions = {
    animation?: CloseAnimation;
};
type HighlightOptions = {
    focus?: boolean;
};
interface RegisteredMenuItem {
    checked?: boolean;
    disabled?: boolean;
    id: string;
    searchValue?: SearchValue;
    submenu?: MenuContextValue;
    type: MenuItemType;
    value?: string;
    name?: string;
    readonly hidden: boolean;
    readonly label: string;
    readonly node: HTMLElement;
}
interface MenuContextValue {
    readonly activeId: string | undefined;
    readonly closeAnimation: CloseAnimation;
    readonly flashingChecked: boolean | undefined;
    readonly flashingId: string | undefined;
    readonly isOpen: boolean;
    readonly isRoot: boolean;
    readonly label: string | undefined;
    readonly listId: string;
    readonly parent: MenuContextValue | undefined;
    readonly root: MenuContextValue;
    readonly state: State;
    readonly surfaceNode: HTMLElement | undefined;
    readonly triggerId: string | undefined;
    activateActive: () => Promise<void>;
    activateItem: (id: string) => Promise<void>;
    allowsPointer: (event: PointerEvent) => boolean;
    closeAll: (options?: CloseAllOptions) => Promise<void>;
    closeBranch: (options?: CloseBranchOptions) => Promise<void>;
    closeSync: (updates: Promise<AbortSignal>[], options?: CloseSyncOptions) => void;
    consumePointerLeaveClearSuppression: () => boolean;
    finishDismissalSync: (updates: Promise<AbortSignal>[]) => void;
    getOpenChild: () => MenuContextValue | undefined;
    hasOpenChild: () => boolean;
    highlight: (id: string | null, options?: HighlightOptions) => void;
    highlightSearchMatch: (text: string) => void;
    navigate: (strategy: NavigationStrategy) => void;
    openActiveSubmenu: () => Promise<void>;
    open: (options?: OpenMenuOptions) => Promise<void>;
    registerChild: (menu: MenuContextValue) => void;
    registerItem: (item: RegisteredMenuItem) => void;
    registerList: (node: HTMLElement) => void;
    registerSurface: (node: HTMLElement) => void;
    registerTrigger: (node: HTMLElement, id: string) => void;
    suppressNextPointerLeaveClear: () => void;
    startHoverAim: (source: HTMLElement | null, target: HTMLElement | null, event: PointerEvent) => boolean;
    unregisterList: (node: HTMLElement) => void;
    unregisterSurface: (node: HTMLElement) => void;
    unregisterTrigger: (node: HTMLElement) => void;
}
declare function MenuProvider(handle: Handle<MenuProviderProps, MenuContextValue>): () => import("@remix-run/ui").RemixElement;
declare const popoverMixin: <boundNode extends HTMLElement = HTMLElement>() => import("@remix-run/ui").MixinDescriptor<boundNode, [], ElementProps>;
export interface MenuListProps extends Props<'div'> {
}
type MenuListChildProps = Omit<JSX.LibraryManagedAttributes<typeof MenuList, MenuListProps>, 'children'>;
export declare const Context: typeof MenuProvider;
export declare const item: <boundNode extends HTMLElement = HTMLElement>(options: MenuItemOptions) => import("@remix-run/ui").MixinDescriptor<boundNode, [options: MenuItemOptions], ElementProps>;
export declare const list: <boundNode extends HTMLElement = HTMLElement>() => import("@remix-run/ui").MixinDescriptor<boundNode, [], ElementProps>;
export { popoverMixin as popover };
export declare const submenuTrigger: <boundNode extends HTMLElement = HTMLElement>(options: SubmenuTriggerOptions) => import("@remix-run/ui").MixinDescriptor<boundNode, [options: SubmenuTriggerOptions], ElementProps>;
export declare const trigger: <boundNode extends HTMLElement = HTMLElement>(options?: MenuTriggerOptions | undefined) => import("@remix-run/ui").MixinDescriptor<boundNode, [options?: MenuTriggerOptions | undefined], ElementProps>;
export declare function onMenuSelect(handler: MenuSelectHandler, captureBoolean?: boolean): import("@remix-run/ui").MixinDescriptor<HTMLElement, ["rmx:menu-select", (event: import("@remix-run/ui").Dispatched<MenuSelectEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, (boolean | undefined)?], ElementProps>;
export interface MenuProps extends Omit<Props<'button'>, 'children'> {
    children?: RemixNode;
    label: RemixNode;
    menuLabel?: string;
}
export interface MenuItemProps extends Omit<Props<'div'>, 'children' | 'name' | 'type' | 'value'>, MenuItemOptions {
    children?: RemixNode;
}
export interface SubmenuProps extends Omit<Props<'div'>, 'children' | 'name' | 'type' | 'value'>, Omit<SubmenuTriggerOptions, 'label'> {
    children?: RemixNode;
    label: RemixNode;
    listProps?: MenuListChildProps;
    menuLabel?: string;
}
export declare function Menu(handle: Handle<MenuProps>): () => import("@remix-run/ui").RemixElement;
export declare function MenuList(handle: Handle<MenuListProps>): () => import("@remix-run/ui").RemixElement;
export declare function MenuItem(handle: Handle<MenuItemProps>): () => import("@remix-run/ui").RemixElement;
export declare function Submenu(handle: Handle<SubmenuProps>): () => import("@remix-run/ui").RemixElement;
