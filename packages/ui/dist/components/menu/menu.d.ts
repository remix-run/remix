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
export declare function onMenuSelect(handler: MenuSelectHandler, captureBoolean?: boolean): import("@remix-run/ui").MixinDescriptor<HTMLElement, [type: "click", handler: (event: import("@remix-run/ui").Dispatched<PointerEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "auxclick", handler: (event: import("@remix-run/ui").Dispatched<PointerEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "keydown", handler: (event: import("@remix-run/ui").Dispatched<KeyboardEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "keyup", handler: (event: import("@remix-run/ui").Dispatched<KeyboardEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "resize", handler: (event: import("@remix-run/ui").Dispatched<UIEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "abort", handler: (event: import("@remix-run/ui").Dispatched<UIEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "rmx:accordion-change", handler: (event: import("@remix-run/ui").Dispatched<import("../accordion/accordion.tsx").AccordionChangeEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "rmx:combobox-change", handler: (event: import("@remix-run/ui").Dispatched<import("../combobox/combobox.tsx").ComboboxChangeEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "rmx:menu-select", handler: (event: import("@remix-run/ui").Dispatched<MenuSelectEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "rmx:select-change", handler: (event: import("@remix-run/ui").Dispatched<import("../select/select.tsx").SelectChangeEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "rmx:tabs-change", handler: (event: import("@remix-run/ui").Dispatched<import("../tabs/tabs.tsx").TabsChangeEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "input", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "error", handler: (event: import("@remix-run/ui").Dispatched<ErrorEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "progress", handler: (event: import("@remix-run/ui").Dispatched<ProgressEvent<EventTarget>, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "select", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "fullscreenchange", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "fullscreenerror", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "animationcancel", handler: (event: import("@remix-run/ui").Dispatched<AnimationEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "animationend", handler: (event: import("@remix-run/ui").Dispatched<AnimationEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "animationiteration", handler: (event: import("@remix-run/ui").Dispatched<AnimationEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "animationstart", handler: (event: import("@remix-run/ui").Dispatched<AnimationEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "beforeinput", handler: (event: import("@remix-run/ui").Dispatched<InputEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "beforematch", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "beforetoggle", handler: (event: import("@remix-run/ui").Dispatched<ToggleEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "blur", handler: (event: import("@remix-run/ui").Dispatched<FocusEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "cancel", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "canplay", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "canplaythrough", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "change", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "close", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "compositionend", handler: (event: import("@remix-run/ui").Dispatched<CompositionEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "compositionstart", handler: (event: import("@remix-run/ui").Dispatched<CompositionEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "compositionupdate", handler: (event: import("@remix-run/ui").Dispatched<CompositionEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "contextlost", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "contextmenu", handler: (event: import("@remix-run/ui").Dispatched<PointerEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "contextrestored", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "copy", handler: (event: import("@remix-run/ui").Dispatched<ClipboardEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "cuechange", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "cut", handler: (event: import("@remix-run/ui").Dispatched<ClipboardEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "dblclick", handler: (event: import("@remix-run/ui").Dispatched<MouseEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "drag", handler: (event: import("@remix-run/ui").Dispatched<DragEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "dragend", handler: (event: import("@remix-run/ui").Dispatched<DragEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "dragenter", handler: (event: import("@remix-run/ui").Dispatched<DragEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "dragleave", handler: (event: import("@remix-run/ui").Dispatched<DragEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "dragover", handler: (event: import("@remix-run/ui").Dispatched<DragEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "dragstart", handler: (event: import("@remix-run/ui").Dispatched<DragEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "drop", handler: (event: import("@remix-run/ui").Dispatched<DragEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "durationchange", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "emptied", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "ended", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "focus", handler: (event: import("@remix-run/ui").Dispatched<FocusEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "focusin", handler: (event: import("@remix-run/ui").Dispatched<FocusEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "focusout", handler: (event: import("@remix-run/ui").Dispatched<FocusEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "formdata", handler: (event: import("@remix-run/ui").Dispatched<FormDataEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "gotpointercapture", handler: (event: import("@remix-run/ui").Dispatched<PointerEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "invalid", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "keypress", handler: (event: import("@remix-run/ui").Dispatched<KeyboardEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "load", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "loadeddata", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "loadedmetadata", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "loadstart", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "lostpointercapture", handler: (event: import("@remix-run/ui").Dispatched<PointerEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "mousedown", handler: (event: import("@remix-run/ui").Dispatched<MouseEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "mouseenter", handler: (event: import("@remix-run/ui").Dispatched<MouseEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "mouseleave", handler: (event: import("@remix-run/ui").Dispatched<MouseEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "mousemove", handler: (event: import("@remix-run/ui").Dispatched<MouseEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "mouseout", handler: (event: import("@remix-run/ui").Dispatched<MouseEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "mouseover", handler: (event: import("@remix-run/ui").Dispatched<MouseEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "mouseup", handler: (event: import("@remix-run/ui").Dispatched<MouseEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "paste", handler: (event: import("@remix-run/ui").Dispatched<ClipboardEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "pause", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "play", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "playing", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "pointercancel", handler: (event: import("@remix-run/ui").Dispatched<PointerEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "pointerdown", handler: (event: import("@remix-run/ui").Dispatched<PointerEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "pointerenter", handler: (event: import("@remix-run/ui").Dispatched<PointerEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "pointerleave", handler: (event: import("@remix-run/ui").Dispatched<PointerEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "pointermove", handler: (event: import("@remix-run/ui").Dispatched<PointerEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "pointerout", handler: (event: import("@remix-run/ui").Dispatched<PointerEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "pointerover", handler: (event: import("@remix-run/ui").Dispatched<PointerEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "pointerrawupdate", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "pointerup", handler: (event: import("@remix-run/ui").Dispatched<PointerEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "ratechange", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "reset", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "scroll", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "scrollend", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "securitypolicyviolation", handler: (event: import("@remix-run/ui").Dispatched<SecurityPolicyViolationEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "seeked", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "seeking", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "selectionchange", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "selectstart", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "slotchange", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "stalled", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "submit", handler: (event: import("@remix-run/ui").Dispatched<SubmitEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "suspend", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "timeupdate", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "toggle", handler: (event: import("@remix-run/ui").Dispatched<ToggleEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "touchcancel", handler: (event: import("@remix-run/ui").Dispatched<TouchEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "touchend", handler: (event: import("@remix-run/ui").Dispatched<TouchEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "touchmove", handler: (event: import("@remix-run/ui").Dispatched<TouchEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "touchstart", handler: (event: import("@remix-run/ui").Dispatched<TouchEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "transitioncancel", handler: (event: import("@remix-run/ui").Dispatched<TransitionEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "transitionend", handler: (event: import("@remix-run/ui").Dispatched<TransitionEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "transitionrun", handler: (event: import("@remix-run/ui").Dispatched<TransitionEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "transitionstart", handler: (event: import("@remix-run/ui").Dispatched<TransitionEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "volumechange", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "waiting", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "webkitanimationend", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "webkitanimationiteration", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "webkitanimationstart", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "webkittransitionend", handler: (event: import("@remix-run/ui").Dispatched<Event, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined] | [type: "wheel", handler: (event: import("@remix-run/ui").Dispatched<WheelEvent, HTMLElement>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean | undefined], ElementProps>;
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
