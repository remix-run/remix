import { createElement, createMixin, on, ref } from '@remix-run/ui';
const TOGGLE_CHANGE_EVENT = 'rmx:toggle-change';
export class ToggleChangeEvent extends Event {
    checked;
    constructor(checked) {
        super(TOGGLE_CHANGE_EVENT, { bubbles: true });
        this.checked = checked;
    }
}
function getBooleanState(value) {
    return value === true || value === false ? value : undefined;
}
function propIsTrue(value) {
    return value === true || value === 'true' || value === '';
}
function isDisabled(options, props) {
    return (options.disabled === true || propIsTrue(props.disabled) || propIsTrue(props['aria-disabled']));
}
function isReadOnly(options, props) {
    return (options.readOnly === true || propIsTrue(props.readOnly) || propIsTrue(props['aria-readonly']));
}
const controlMixin = createMixin((handle, hostType) => {
    let uncontrolledChecked = false;
    let hasInitialized = false;
    function getChecked(options, props) {
        let optionChecked = getBooleanState(options.checked);
        if (optionChecked !== undefined) {
            return optionChecked;
        }
        let propChecked = getBooleanState(props.checked);
        if (propChecked !== undefined) {
            return propChecked;
        }
        if (!hasInitialized) {
            uncontrolledChecked =
                getBooleanState(options.defaultChecked) ?? getBooleanState(props.defaultChecked) ?? false;
            hasInitialized = true;
        }
        return uncontrolledChecked;
    }
    function setChecked(node, options, props, nextChecked) {
        if (isDisabled(options, props) || isReadOnly(options, props)) {
            if (node instanceof HTMLInputElement) {
                node.checked = getChecked(options, props);
            }
            return;
        }
        if (options.checked === undefined && props.checked === undefined) {
            uncontrolledChecked = nextChecked;
            void handle.update();
        }
        options.onCheckedChange?.(nextChecked);
        node.dispatchEvent(new ToggleChangeEvent(nextChecked));
    }
    return (options = {}, props) => {
        let checked = getChecked(options, props);
        let disabled = isDisabled(options, props);
        let readOnly = isReadOnly(options, props);
        let required = options.required ?? props.required;
        let nextProps = {
            ...props,
            'aria-checked': hostType === 'input' ? undefined : checked,
            'aria-disabled': hostType === 'input' ? undefined : disabled || undefined,
            'aria-readonly': hostType === 'input' ? undefined : readOnly || undefined,
            'aria-required': hostType === 'input' ? undefined : required || undefined,
            checked: hostType === 'input' ? checked : props.checked,
            defaultChecked: hostType === 'input' ? undefined : props.defaultChecked,
            disabled: hostType === 'input' ? disabled || undefined : props.disabled,
            form: hostType === 'input' ? (options.form ?? props.form) : props.form,
            name: hostType === 'input' ? (options.name ?? props.name) : props.name,
            readOnly: hostType === 'input' ? readOnly || undefined : props.readOnly,
            required: hostType === 'input' ? required : props.required,
            role: 'switch',
            tabIndex: hostType === 'input'
                ? (options.tabIndex ?? props.tabIndex)
                : disabled
                    ? undefined
                    : (options.tabIndex ?? props.tabIndex ?? 0),
            type: hostType === 'input'
                ? props.type === undefined
                    ? 'checkbox'
                    : props.type
                : hostType === 'button' && props.type === undefined
                    ? 'button'
                    : props.type,
            value: hostType === 'input' ? (options.value ?? props.value) : props.value,
            'data-state': checked ? 'checked' : 'unchecked',
        };
        return createElement(handle.element, {
            ...nextProps,
            mix: [
                ref((node, signal) => {
                    if (node instanceof HTMLInputElement) {
                        options.inputRef?.(node, signal);
                    }
                }),
                on('click', (event) => {
                    if (hostType !== 'input') {
                        event.preventDefault();
                    }
                    if (disabled || readOnly) {
                        if (event.currentTarget instanceof HTMLInputElement) {
                            event.currentTarget.checked = checked;
                        }
                        return;
                    }
                    let nextChecked = event.currentTarget instanceof HTMLInputElement
                        ? event.currentTarget.checked
                        : !checked;
                    setChecked(event.currentTarget, options, props, nextChecked);
                }),
                on('keydown', (event) => {
                    if (hostType === 'input' || event.key !== ' ') {
                        return;
                    }
                    event.preventDefault();
                    setChecked(event.currentTarget, options, props, !checked);
                }),
            ],
        });
    };
});
export const control = controlMixin;
export function onToggleChange(handler, captureBoolean) {
    return on(TOGGLE_CHANGE_EVENT, handler, captureBoolean);
}
//# sourceMappingURL=primitives.js.map