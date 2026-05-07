import { createMixin, renderMixinElement } from "../runtime/mixins/mixin.js";
import { invariant } from "../runtime/invariant.js";
import { processStyleClass } from "../style/index.js";
const clientStyleCache = new Map();
/**
 * Applies generated class names for CSS object styles.
 */
export const css = createMixin((handle) => {
    let activeSelector = '';
    let activeGeneration = -1;
    let currentStyles = {};
    handle.addEventListener('remove', () => {
        if (!activeSelector)
            return;
        let runtime = handle.frame.$runtime;
        invariant(runtime, 'css mixin requires frame runtime');
        let styleTarget = resolveStyleTarget(runtime);
        styleTarget.styleManager?.remove(activeSelector);
        activeSelector = '';
        activeGeneration = -1;
    });
    return (styles, props) => {
        currentStyles = styles;
        let runtime = handle.frame.$runtime;
        invariant(runtime, 'css mixin requires frame runtime');
        let styleTarget = resolveStyleTarget(runtime);
        let { selector, css: cssText } = processStyleClass(currentStyles, styleTarget.styleCache);
        let styleGeneration = styleTarget.styleManager?.getGeneration?.() ?? 0;
        if (styleTarget.styleManager) {
            if (activeSelector && activeSelector !== selector) {
                styleTarget.styleManager.remove(activeSelector);
            }
            if (selector && (activeSelector !== selector || activeGeneration !== styleGeneration)) {
                styleTarget.styleManager.insert(selector, cssText);
            }
            activeSelector = selector;
            activeGeneration = selector ? styleGeneration : -1;
        }
        if (!selector) {
            return handle.element;
        }
        return renderMixinElement(handle.element, {
            ...(props ?? {}),
            className: props?.className ? `${props.className} ${selector}` : selector,
        });
    };
});
function resolveStyleTarget(runtime) {
    return {
        styleCache: runtime.styleCache ?? clientStyleCache,
        styleManager: runtime.styleManager,
    };
}
//# sourceMappingURL=css-mixin.js.map