import type { CSSMixinDescriptor, Handle, Props, RemixNode } from '@remix-run/ui';
import type { SearchValue } from '../shared/typeahead.ts';
export declare const buttonStyle: CSSMixinDescriptor;
export declare const popoverStyle: CSSMixinDescriptor;
export declare const listStyle: CSSMixinDescriptor;
export declare const itemStyle: CSSMixinDescriptor;
export declare const itemSlotStyle: CSSMixinDescriptor;
export declare const itemLabelStyle: CSSMixinDescriptor;
export declare const itemIndicatorStyle: CSSMixinDescriptor;
export declare const triggerIndicatorStyle: CSSMixinDescriptor;
export interface MenuListProps extends Props<'div'> {
}
type MenuListChildProps = Omit<JSX.LibraryManagedAttributes<typeof MenuList, MenuListProps>, 'children'>;
export interface MenuProps extends Omit<Props<'button'>, 'children'> {
    children?: RemixNode;
    label: RemixNode;
    menuLabel?: string;
}
export interface MenuItemProps extends Omit<Props<'div'>, 'children' | 'name' | 'type' | 'value'> {
    checked?: boolean;
    children?: RemixNode;
    disabled?: boolean;
    label?: string;
    name: string;
    searchValue?: SearchValue;
    type?: 'checkbox' | 'radio';
    value?: string;
}
export interface SubmenuProps extends Omit<Props<'div'>, 'children' | 'name' | 'type' | 'value'> {
    children?: RemixNode;
    disabled?: boolean;
    label: RemixNode;
    listProps?: MenuListChildProps;
    menuLabel?: string;
    searchValue?: SearchValue;
    value?: string;
}
export declare function Menu(handle: Handle<MenuProps>): () => RemixNode;
export declare function MenuList(handle: Handle<MenuListProps>): () => RemixNode;
export declare function MenuItem(handle: Handle<MenuItemProps>): () => RemixNode;
export declare function Submenu(handle: Handle<SubmenuProps>): () => RemixNode;
export {};
