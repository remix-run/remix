import { jsx as _jsx } from "@remix-run/ui/jsx-runtime";
import { Breadcrumbs } from '@remix-run/ui/breadcrumbs';
/**
 * @name Breadcrumbs Basic
 * @description A basic breadcrumb trail linking back through the page hierarchy.
 * @layout center
 */
export default function Example() {
    return () => (_jsx(Breadcrumbs, { items: [
            { href: '/', label: 'Home' },
            { href: '/components', label: 'Components' },
            { label: 'Breadcrumbs' },
        ] }));
}
//# sourceMappingURL=basic.demo.js.map