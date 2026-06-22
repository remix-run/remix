import type { Handle, Props, RemixElement } from '@remix-run/ui';
type IconProps = Omit<Props<'svg'>, 'children'>;
export declare function AddIcon(handle: Handle<IconProps>): () => RemixElement;
export declare function CheckIcon(handle: Handle<IconProps>): () => RemixElement;
export declare function ChevronDownIcon(handle: Handle<IconProps>): () => RemixElement;
export declare function ChevronRightIcon(handle: Handle<IconProps>): () => RemixElement;
export declare function ChevronVerticalIcon(handle: Handle<IconProps>): () => RemixElement;
export {};
