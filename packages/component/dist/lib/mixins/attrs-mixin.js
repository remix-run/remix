import { jsx as _jsx } from "@remix-run/component/jsx-runtime";
// @jsxRuntime classic
// @jsx jsx
import { createMixin } from "../mixin.js";
import { jsx } from "../jsx.js";
let attrsMixin = createMixin((handle) => (defaults, props) => {
    let nextProps = props;
    for (let key in defaults) {
        if (props[key] !== undefined)
            continue;
        if (nextProps === props)
            nextProps = { ...props };
        nextProps[key] = defaults[key];
    }
    return nextProps === props ? handle.element : _jsx(handle.element, { ...nextProps });
});
/**
 * Applies default host props unless the element already provides them explicitly.
 *
 * @param defaults Default props to apply when the element does not already define them.
 * @returns A mixin descriptor that provides default host props.
 */
export function attrs(defaults) {
    return attrsMixin(defaults);
}
//# sourceMappingURL=attrs-mixin.js.map