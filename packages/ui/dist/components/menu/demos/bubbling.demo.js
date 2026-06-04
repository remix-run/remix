import { jsx as _jsx, jsxs as _jsxs } from "@remix-run/ui/jsx-runtime";
import { on } from '@remix-run/ui';
import { Menu, MenuItem, onMenuSelect } from '@remix-run/ui/menu';
/**
 * @name Menu Event Bubbling
 * @description Item-level handlers fire before the root handler, letting individual items intercept events while others bubble up.
 * @layout center
 */
export default function Example() {
    return () => (_jsxs(Menu, { label: "Project", menuLabel: "Project actions", mix: onMenuSelect((event) => {
            console.log('Menu root handler:', event.item);
        }), children: [_jsx(MenuItem, { name: "open", value: "open-project", children: "Open project" }), _jsx(MenuItem, { name: "rename", value: "rename-project", mix: onMenuSelect((event) => {
                    console.log('Menu item handler:', event.item);
                }), children: "Rename project" }), _jsx(MenuItem, { name: "duplicate", value: "duplicate-project", children: "Duplicate project" })] }));
}
//# sourceMappingURL=bubbling.demo.js.map