import { jsx as _jsx, jsxs as _jsxs } from "@remix-run/ui/jsx-runtime";
import {} from '@remix-run/ui';
import { Menu, MenuItem, onMenuSelect, Submenu } from '@remix-run/ui/menu';
import { separatorStyle } from '@remix-run/ui/separator';
/**
 * @name Menu Overview
 * @description A hierarchical menu with checkboxes, radio groups, submenus, and separators.
 */
export default function Example(handle) {
    let wordWrap = true;
    let minimap = false;
    let showGutter = true;
    let density = 'comfortable';
    return () => (_jsxs(Menu, { label: "View", menuLabel: "View options", mix: onMenuSelect((event) => {
            switch (event.item.name) {
                case 'wordWrap':
                    wordWrap = !wordWrap;
                    break;
                case 'minimap':
                    minimap = !minimap;
                    break;
                case 'showGutter':
                    showGutter = !showGutter;
                    break;
                case 'density':
                    density = event.item.value;
                    break;
            }
            handle.update();
        }), children: [_jsx(MenuItem, { name: "wordWrap", type: "checkbox", checked: wordWrap, children: "Word wrap" }), _jsx(MenuItem, { name: "minimap", type: "checkbox", checked: minimap, children: "Minimap" }), _jsx(MenuItem, { name: "showGutter", type: "checkbox", checked: showGutter, children: "Show gutter" }), _jsx("hr", { mix: separatorStyle }), _jsxs(Submenu, { label: "Zoom", children: [_jsx(MenuItem, { name: "zoomIn", value: "zoom-in", children: "Zoom In" }), _jsx(MenuItem, { name: "zoomOut", value: "zoom-out", children: "Zoom Out" }), _jsx(MenuItem, { name: "resetZoom", value: "reset-zoom", children: "Reset Zoom" })] }), _jsxs(Submenu, { label: "Density", children: [_jsx(MenuItem, { name: "density", type: "radio", value: "comfortable", checked: density === 'comfortable', children: "Comfortable" }), _jsx(MenuItem, { name: "density", type: "radio", value: "compact", checked: density === 'compact', children: "Compact" })] })] }));
}
//# sourceMappingURL=overview.demo.js.map