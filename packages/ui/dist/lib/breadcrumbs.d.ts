import type { Props, RemixNode } from '@remix-run/component';
export type BreadcrumbItem = {
    current?: boolean;
    href?: string;
    label: RemixNode;
};
export type BreadcrumbsProps = Omit<Props<'nav'>, 'children'> & {
    items: BreadcrumbItem[];
    separator?: RemixNode;
};
export declare function Breadcrumbs(): ({ "aria-label": ariaLabel, items, separator, mix, ...navProps }: BreadcrumbsProps) => import("@remix-run/component").RemixElement;
