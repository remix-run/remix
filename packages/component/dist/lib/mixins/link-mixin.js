import { jsx as _jsx } from "@remix-run/component/jsx-runtime";
// @jsxRuntime classic
// @jsx jsx
import { createMixin } from "../mixin.js";
import { jsx } from "../jsx.js";
import { navigate } from "../navigation.js";
import { on } from "./on-mixin.js";
let nativeLinkHostTypes = new Set(['a', 'area']);
export let link = createMixin((handle, hostType) => {
    let suppressKeyboardClick = false;
    return (href, options, props) => {
        if (nativeLinkHostTypes.has(hostType)) {
            return (_jsx(handle.element, { ...props, href: href, ...(options?.target == null ? {} : { 'rmx-target': options.target }), ...(options?.src == null ? {} : { 'rmx-src': options.src }), ...(options?.resetScroll === false ? { 'rmx-reset-scroll': 'false' } : {}) }));
        }
        let nextProps = { ...props };
        if (nextProps.role == null) {
            nextProps.role = 'link';
        }
        if (nextProps.disabled === true && nextProps['aria-disabled'] == null) {
            nextProps['aria-disabled'] = 'true';
        }
        if (hostType === 'button' && nextProps.type == null) {
            nextProps.type = 'button';
        }
        if (hostType !== 'button' &&
            nextProps.tabIndex == null &&
            nextProps.tabindex == null &&
            nextProps.contentEditable == null &&
            nextProps.contenteditable == null) {
            nextProps.tabIndex = 0;
        }
        return (_jsx(handle.element, { ...nextProps, mix: [
                on('click', (event) => {
                    if (event.detail === 0 && suppressKeyboardClick) {
                        suppressKeyboardClick = false;
                        event.preventDefault();
                        return;
                    }
                    suppressKeyboardClick = false;
                    if (isDisabledElement(event.currentTarget)) {
                        event.preventDefault();
                        return;
                    }
                    if (event.button !== 0)
                        return;
                    event.preventDefault();
                    if (event.metaKey || event.ctrlKey) {
                        globalThis.open(href, '_blank');
                        return;
                    }
                    void navigate(href, options);
                }),
                on('auxclick', (event) => {
                    suppressKeyboardClick = false;
                    if (isDisabledElement(event.currentTarget)) {
                        event.preventDefault();
                        return;
                    }
                    if (event.button !== 1)
                        return;
                    event.preventDefault();
                    globalThis.open(href, '_blank');
                }),
                on('keydown', (event) => {
                    if (event.key === 'Enter') {
                        if (event.repeat)
                            return;
                        if (isDisabledElement(event.currentTarget)) {
                            event.preventDefault();
                            return;
                        }
                        suppressKeyboardClick = hostType === 'button';
                        event.preventDefault();
                        void navigate(href, options);
                        return;
                    }
                    if (hostType === 'button' && event.key === ' ') {
                        suppressKeyboardClick = true;
                        event.preventDefault();
                    }
                }),
                on('keyup', (event) => {
                    if (hostType === 'button' && event.key === ' ') {
                        event.preventDefault();
                    }
                }),
            ] }));
    };
});
function isDisabledElement(node) {
    return (('disabled' in node && node.disabled === true) || node.getAttribute('aria-disabled') === 'true');
}
//# sourceMappingURL=link-mixin.js.map