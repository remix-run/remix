import { jsx as _jsx, jsxs as _jsxs } from "remix/component/jsx-runtime";
/**
 * A wrapper around the `<form>` element that supports RESTful API methods like `PUT` and `DELETE`.
 *
 * When the method is not `GET` or `POST`, a hidden <input> field is added to the form with a
 * "method override" value that instructs the server to use the specified method when routing
 * the request.
 */
export function RestfulForm() {
    return ({ method = 'GET', methodOverrideField = '_method', ...props }) => {
        let upperMethod = method.toUpperCase();
        if (upperMethod === 'GET') {
            return _jsx("form", { method: "GET", ...props });
        }
        return (_jsxs("form", { method: "POST", ...props, children: [upperMethod !== 'POST' && (_jsx("input", { type: "hidden", name: methodOverrideField, value: upperMethod })), props.children] }));
    };
}
