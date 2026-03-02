import { jsx as _jsx } from "@remix-run/component/jsx-runtime";
// @jsxRuntime classic
// @jsx jsx
import { createMixin } from "../mixin.js";
import { jsx } from "../jsx.js";
import { invariant } from "../invariant.js";
import { processStyleClass } from "../style/index.js";
let clientStyleCache = new Map();
export let css = createMixin((handle) => {
    let activeSelector = '';
    let currentStyles = {};
    handle.addEventListener('remove', () => {
        if (!activeSelector)
            return;
        let runtime = handle.frame.$runtime;
        invariant(runtime, 'css mixin requires frame runtime');
        let styleTarget = resolveStyleTarget(runtime);
        styleTarget.styleManager?.remove(activeSelector);
        activeSelector = '';
    });
    return (styles, props) => {
        currentStyles = styles;
        let runtime = handle.frame.$runtime;
        invariant(runtime, 'css mixin requires frame runtime');
        let styleTarget = resolveStyleTarget(runtime);
        let { selector, css: cssText } = processStyleClass(currentStyles, styleTarget.styleCache);
        if (styleTarget.styleManager) {
            if (activeSelector && activeSelector !== selector) {
                styleTarget.styleManager.remove(activeSelector);
            }
            if (selector && activeSelector !== selector) {
                styleTarget.styleManager.insert(selector, cssText);
            }
            activeSelector = selector;
        }
        if (!selector) {
            return handle.element;
        }
        return (_jsx(handle.element, { ...props, className: props.className ? `${props.className} ${selector}` : selector }));
    };
});
function resolveStyleTarget(runtime) {
    return {
        styleCache: runtime.styleCache ?? clientStyleCache,
        styleManager: runtime.styleManager,
    };
}
//# sourceMappingURL=css-mixin.js.map