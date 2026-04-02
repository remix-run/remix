import { jsx } from "./jsx.js";
/**
 * Creates a Remix virtual element from a JSX-like call signature.
 *
 * @param type Host tag or component function.
 * @param props Element props.
 * @param children Child nodes.
 * @returns A Remix virtual element.
 */
export function createElement(type, props, ...children) {
    if (props?.key != null) {
        let { key, ...rest } = props;
        return jsx(type, { ...rest, children }, key);
    }
    return jsx(type, { ...props, children });
}
//# sourceMappingURL=create-element.js.map