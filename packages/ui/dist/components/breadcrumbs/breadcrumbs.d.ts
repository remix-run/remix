import type { Handle, Props, RemixNode } from '@remix-run/ui';
export type BreadcrumbItem = {
    current?: boolean;
    href?: string;
    label: RemixNode;
};
export type BreadcrumbsProps = Omit<Props<'nav'>, 'children'> & {
    items: BreadcrumbItem[];
    separator?: RemixNode;
};
export declare function Breadcrumbs(handle: Handle<BreadcrumbsProps>): () => import("@remix-run/ui").RemixElement;
