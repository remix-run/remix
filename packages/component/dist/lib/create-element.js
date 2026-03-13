import { jsx } from "./jsx.js";
export function createElement(type, props, ...children) {
    if (props?.key != null) {
        let { key, ...rest } = props;
        return jsx(type, { ...rest, children }, key);
    }
    return jsx(type, { ...props, children });
}
//# sourceMappingURL=create-element.js.map