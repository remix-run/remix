import { createElement, createMixin, on, ref } from '@remix-run/component';
const INPUT_VALIDATION_EVENT = 'rmx:input-validation';
/** A bubbling notification for rendering application-owned field errors. */
export class InputValidationEvent extends Event {
    /** The projected field name. */
    field;
    /** The id of the application's error element. */
    errorId;
    /** The errors to display for this field. */
    errors;
    /** Whether client feedback has been revealed for this input. */
    touched;
    /**
     * Creates a validation notification.
     *
     * @param state The field's presentation-ready validation state.
     */
    constructor(state) {
        super(INPUT_VALIDATION_EVENT, { bubbles: true });
        this.field = state.field;
        this.errorId = state.errorId;
        this.errors = [...state.errors];
        this.touched = state.touched;
    }
}
export const formValidity = createMixin(() => () => [
    on('focusout', (event) => {
        let control = getValidatableControl(event.target);
        if (control && !control.hasAttribute('data-form-input')) {
            control.setAttribute('data-touched', '');
            syncValidity(control);
        }
    }),
    on('input', (event) => {
        let control = getValidatableControl(event.target);
        if (!control || control.hasAttribute('data-form-input')) {
            return;
        }
        let hadServerError = control.hasAttribute('data-form-error-id');
        if (hadServerError) {
            clearServerError(control);
        }
        if (hadServerError || control.hasAttribute('data-touched')) {
            syncValidity(control);
        }
    }),
    on('invalid', (event) => {
        let control = getValidatableControl(event.target);
        if (control && !control.hasAttribute('data-form-input')) {
            control.setAttribute('data-touched', '');
            syncValidity(control);
        }
    }, true),
]);
export const fieldValidity = createMixin((handle, hostType) => {
    let previousConfig;
    let mountedControl;
    let resetControl;
    handle.addEventListener('insert', (event) => {
        mountedControl = event.node;
        if (previousConfig) {
            let { feedback } = previousConfig;
            let key = getControlKey(event.node);
            if (feedback.customValue !== undefined && feedback.customValue !== key) {
                feedback.customErrors = [];
            }
            feedback.customValue = key;
            validateInput(event.node, previousConfig, feedback.customErrors);
        }
    });
    handle.addEventListener('remove', () => {
        mountedControl = undefined;
        if (previousConfig)
            previousConfig.feedback.refreshControl = undefined;
    });
    return (getConfig, props) => {
        let config = getConfig();
        let feedback = config.feedback;
        if (previousConfig && previousConfig.feedback !== feedback) {
            previousConfig.feedback.refreshControl = undefined;
            handle.queueTask(() => {
                if (mountedControl && previousConfig?.feedback === feedback) {
                    let nextProps = getFeedbackProps();
                    if (mountedControl instanceof HTMLInputElement &&
                        typeof nextProps.defaultChecked === 'boolean' &&
                        nextProps.checked === undefined) {
                        mountedControl.checked = nextProps.defaultChecked;
                    }
                    else if (typeof nextProps.defaultValue === 'string' && nextProps.value === undefined) {
                        mountedControl.value = nextProps.defaultValue;
                    }
                    updateFeedback(mountedControl, 'sync');
                }
            });
        }
        previousConfig = config;
        function getFeedbackProps() {
            let { touched, hasServerErrors, errors } = feedback;
            let attrs = { ...config.attrs, ...props };
            if (hostType !== 'input') {
                delete attrs.type;
                delete attrs.defaultChecked;
            }
            if (hostType === 'select')
                delete attrs.defaultValue;
            let describedBy = typeof attrs['aria-describedby'] === 'string'
                ? attrs['aria-describedby'].split(/\s+/).filter((id) => id && id !== config.errorId)
                : [];
            if (errors.length > 0)
                describedBy.push(config.errorId);
            return {
                ...attrs,
                'data-form-input': '',
                'data-touched': touched ? '' : undefined,
                'data-form-error-id': hasServerErrors ? config.errorId : undefined,
                'aria-invalid': props['aria-invalid'] ?? (errors.length > 0 ? 'true' : undefined),
                'aria-describedby': describedBy.length > 0 ? describedBy.join(' ') : undefined,
            };
        }
        function updateFeedback(input, reason) {
            let previous = { ...feedback };
            let key = getControlKey(input);
            if (reason === 'reset' ||
                (feedback.customValue !== undefined && feedback.customValue !== key)) {
                feedback.customErrors = [];
            }
            feedback.customValue = key;
            let errors = validateInput(input, config, feedback.customErrors);
            if (reason === 'input') {
                feedback.touched ||= feedback.hasServerErrors;
                feedback.hasServerErrors = false;
            }
            else if (reason === 'reset') {
                feedback.touched = false;
                feedback.hasServerErrors = false;
            }
            else if (reason === 'focusout' || reason === 'invalid') {
                feedback.touched = true;
            }
            if (!feedback.hasServerErrors) {
                feedback.errors = feedback.touched ? errors : [];
            }
            let props = getFeedbackProps();
            setAttribute(input, 'aria-invalid', props['aria-invalid']);
            setAttribute(input, 'aria-describedby', props['aria-describedby']);
            input.toggleAttribute('data-touched', feedback.touched);
            if (!feedback.hasServerErrors)
                input.removeAttribute('data-form-error-id');
            config.onFeedbackChange(previous);
            input.dispatchEvent(new InputValidationEvent({
                field: config.field,
                errorId: config.errorId,
                errors: feedback.errors,
                touched: feedback.touched,
            }));
        }
        feedback.refreshControl = function refreshControl() {
            let nextConfig = getConfig();
            if (nextConfig.feedback !== feedback)
                feedback.refreshControl = undefined;
            config = nextConfig;
            feedback = config.feedback;
            feedback.refreshControl = refreshControl;
            previousConfig = config;
            if (mountedControl)
                updateFeedback(mountedControl, 'custom');
        };
        resetControl = (control) => updateFeedback(control, 'reset');
        return createElement(handle.element, {
            ...getFeedbackProps(),
            mix: [
                ref((control, signal) => {
                    control.form?.addEventListener('reset', (event) => {
                        queueMicrotask(() => {
                            if (!event.defaultPrevented && !signal.aborted)
                                resetControl(control);
                        });
                    }, { signal });
                }),
                on('input', (event) => updateFeedback(event.currentTarget, 'input')),
                on('change', (event) => updateFeedback(event.currentTarget, 'input')),
                on('focusout', (event) => updateFeedback(event.currentTarget, 'focusout')),
                on('invalid', (event) => updateFeedback(event.currentTarget, 'invalid')),
            ],
        });
    };
});
/**
 * Observes field feedback without taking ownership of its markup or disabling default behavior.
 *
 * @param handler Receives the field, error element id, visible errors, and touched state.
 * @param captureBoolean Whether to listen during capture (false by default).
 * @returns An event mixin for an input or an ancestor such as its form.
 */
export function onInputValidation(handler, captureBoolean) {
    return on(INPUT_VALIDATION_EVENT, handler, captureBoolean);
}
function validateInput(input, config, customErrors = []) {
    let previousMessage = input.validity.customError ? input.validationMessage : '';
    input.setCustomValidity('');
    try {
        if (input.validity.valid) {
            config.validate(input);
        }
        else if (config.errorMap) {
            let issue = getNativeIssue(input);
            if (issue) {
                let message = config.errorMap({
                    ...issue,
                    defaultMessage: input.validationMessage,
                    path: [config.field],
                    input: getControlValue(input),
                });
                if (message !== undefined)
                    input.setCustomValidity(message);
            }
        }
        let message = input.validationMessage;
        let errors = message ? [message, ...customErrors] : customErrors;
        if (input.validity.valid)
            input.setCustomValidity(customErrors[0] ?? '');
        return errors;
    }
    catch (error) {
        input.setCustomValidity(previousMessage || customErrors[0] || '');
        throw error;
    }
}
function getNativeIssue(input) {
    let validity = input.validity;
    let type = input instanceof HTMLInputElement ? input.type : undefined;
    if (validity.valueMissing)
        return { code: 'value.required' };
    if (validity.badInput)
        return type === 'number' ? { code: 'type.number' } : undefined;
    if (validity.typeMismatch) {
        if (type === 'email')
            return { code: 'string.email' };
        if (type === 'url')
            return { code: 'string.url' };
        return undefined;
    }
    // Native-only constraints keep browser wording, even when another flag is also set.
    if (validity.patternMismatch)
        return undefined;
    if (!(input instanceof HTMLSelectElement)) {
        if (validity.tooLong)
            return { code: 'string.max_length', values: { max: input.maxLength } };
        if (validity.tooShort)
            return { code: 'string.min_length', values: { min: input.minLength } };
    }
    if (input instanceof HTMLInputElement && type === 'number') {
        if (validity.rangeUnderflow)
            return { code: 'number.min', values: { min: Number(input.min) } };
        if (validity.rangeOverflow)
            return { code: 'number.max', values: { max: Number(input.max) } };
    }
}
function getControlValue(input) {
    if (input instanceof HTMLInputElement) {
        if (input.type === 'checkbox')
            return input.checked;
        if (input.type === 'number') {
            if (input.validity.badInput)
                return NaN;
            return input.value.trim() === '' ? undefined : Number(input.value);
        }
    }
    return input.value === '' ? undefined : input.value;
}
function getControlKey(control) {
    return JSON.stringify([
        control.value,
        control instanceof HTMLInputElement ? control.checked : undefined,
    ]);
}
function setAttribute(element, name, value) {
    if (value === undefined || value === null) {
        element.removeAttribute(name);
    }
    else {
        element.setAttribute(name, String(value));
    }
}
function getValidatableControl(target) {
    if (target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement) {
        return target;
    }
}
function syncValidity(control) {
    if (control.validity.valid) {
        control.removeAttribute('aria-invalid');
    }
    else {
        control.setAttribute('aria-invalid', 'true');
    }
}
function clearServerError(control) {
    let errorId = control.getAttribute('data-form-error-id');
    if (!errorId) {
        return;
    }
    let describedBy = control
        .getAttribute('aria-describedby')
        ?.split(/\s+/)
        .filter((id) => id && id !== errorId);
    if (describedBy && describedBy.length > 0) {
        control.setAttribute('aria-describedby', describedBy.join(' '));
    }
    else {
        control.removeAttribute('aria-describedby');
    }
    let error = control.ownerDocument.getElementById(errorId);
    if (error instanceof HTMLElement) {
        error.hidden = true;
    }
    control.removeAttribute('data-form-error-id');
}
//# sourceMappingURL=form-control.js.map