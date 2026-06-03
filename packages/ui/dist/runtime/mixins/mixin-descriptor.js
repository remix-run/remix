import { jsx } from "../jsx.js";
export function renderMixinElement(element, props) {
    let { key, ...rest } = (props ?? {});
    return jsx(element, rest, key);
}
/**
 * Creates a typed mixin factory that can be passed through the `mix` prop.
 *
 * @param type Mixin setup function.
 * @returns A function that captures mixin arguments and returns a descriptor.
 */
export function createMixin(type) {
    return (...args) => ({
        type: type,
        args: args,
    });
}
//# sourceMappingURL=mixin-descriptor.js.map