import { getSchemaMetadata } from '@remix-run/data-schema';
import { attrs, createElement, createMixin, on, ref } from '@remix-run/component';
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
const formValidity = createMixin(() => () => [
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
const fieldValidity = createMixin((handle, hostType) => {
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
 * Enhances unmanaged native controls with touched state and accessible invalid attributes.
 *
 * @returns A mixin for a native form element.
 */
export function form() {
    return formValidity();
}
/**
 * Binds one reusable field definition to a native control without requiring a form binding.
 *
 * Create once in component setup. State properties remain live across renders; a new submission
 * resets touched state. `onChange` fires when errors or touched state change.
 * A field definition's `errorMap` customizes supported native failures as well as schema errors.
 *
 * @param fieldDefinition Shared field attributes, validation, and server error readers.
 * @param options Logical name, submission getter, and optional render notification.
 * @returns Control, label, and error mixins with live read-only state.
 */
export function createFieldMixins(fieldDefinition, options) {
    let previousSubmission;
    let feedback;
    function getFeedback() {
        let submission = options.getSubmission?.();
        if (!feedback || submission !== previousSubmission) {
            previousSubmission = submission;
            let errors = fieldDefinition.getFieldErrors(options.name, submission);
            feedback = {
                touched: false,
                hasServerErrors: errors.length > 0,
                errors,
                customErrors: [],
                refreshControl: feedback?.refreshControl,
            };
        }
        return feedback;
    }
    return Object.freeze({
        get errors() {
            return getFeedback().errors;
        },
        get touched() {
            return getFeedback().touched;
        },
        setCustomErrors(messages) {
            let feedback = getFeedback();
            feedback.customErrors = messages.filter((message) => message.length > 0);
            feedback.customValue = undefined;
            feedback.refreshControl?.();
        },
        field() {
            return fieldValidity(() => {
                let feedback = getFeedback();
                return {
                    attrs: fieldDefinition.getInputAttrs(options.name, options.getSubmission?.()),
                    validate: fieldDefinition.createInputValidator(options.name),
                    field: options.name,
                    errorMap: fieldDefinition.errorMap,
                    errorId: fieldDefinition.getErrorAttrs(options.name).id,
                    feedback,
                    onFeedbackChange(previous) {
                        if (getFeedback() !== feedback)
                            return;
                        if (previous.touched !== feedback.touched ||
                            previous.errors.length !== feedback.errors.length ||
                            previous.errors.some((message, index) => message !== feedback.errors[index])) {
                            options.onChange?.();
                        }
                    },
                };
            });
        },
        label() {
            return attrs(fieldDefinition.getLabelAttrs(options.name));
        },
        error() {
            return attrs(fieldDefinition.getErrorAttrs(options.name));
        },
    });
}
/**
 * Binds form and control mixins to a schema-backed form definition.
 *
 * Supplies SSR attributes, restored values, native-first validation, and error accessibility.
 * Client feedback appears after blur or a blocked submission; render live `fields.name.errors`
 * in application-owned markup linked with `error(name)`. Explicit host props win.
 * Create once in setup. `getSubmission` reads current state during rendering or field access;
 * a new submission resets feedback without firing `onChange`. Use `onChange` to request a render
 * when visible errors or touched state change.
 *
 * @param formDefinition Form definition that provides attributes, errors, and field validators.
 * @param options Current submission source and render notification (optional).
 * @returns Related form, control, label, and error mixin factories, plus live field state.
 */
export function createFormMixins(formDefinition, options = {}) {
    let bindings = {};
    let fieldStates = {};
    let errors = {};
    for (let field in formDefinition.fields) {
        if (!Object.hasOwn(formDefinition.fields, field))
            continue;
        Object.defineProperty(bindings, field, {
            enumerable: true,
            value: createFieldMixins({
                errorMap: formDefinition.fields[field].errorMap,
                getInputAttrs(_name, submission) {
                    return formDefinition.getInputAttrs(field, submission);
                },
                createInputValidator() {
                    return formDefinition.createInputValidator(field);
                },
                getLabelAttrs() {
                    return formDefinition.getLabelAttrs(field);
                },
                getErrorAttrs() {
                    return formDefinition.getErrorAttrs(field);
                },
                getFieldErrors(_name, submission) {
                    return formDefinition.getFieldErrors(field, submission);
                },
            }, { ...options, name: field }),
        });
        Object.defineProperty(errors, field, {
            enumerable: true,
            get() {
                return bindings[field].errors;
            },
        });
        Object.defineProperty(fieldStates, field, { enumerable: true, value: bindings[field] });
    }
    return {
        // Every own projected field has one independent binding installed above.
        fields: Object.freeze(fieldStates),
        // Every own projected field has a live getter installed above.
        errors: Object.freeze(errors),
        form() {
            return formValidity();
        },
        input(field) {
            return getBinding(field).field();
        },
        field(field) {
            return getBinding(field).field();
        },
        label(field) {
            return getBinding(field).label();
        },
        error(field) {
            return getBinding(field).error();
        },
    };
    function getBinding(field) {
        if (!Object.hasOwn(bindings, field))
            throw new Error(`Unknown form field "${field}"`);
        return bindings[field];
    }
}
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
/**
 * Creates a reusable field definition with native constraints and server parsing.
 * @param options The field's schema and UI metadata; names default when the field is bound.
 * @returns A stateless field definition that can be used independently or composed into a form.
 */
export function createField(options) {
    let constraints = getConstraints(options.schema, { type: options.type });
    function validate(rawValue, name) {
        let value = decodeFormValue(rawValue, options.type);
        let errorMap = options.errorMap;
        return options.schema['~run'](value, {
            path: name === undefined ? [] : [name],
            options: errorMap
                ? {
                    errorMap(context) {
                        let missing = constraints.required && (value === undefined || value === false);
                        return errorMap(missing ? { ...context, code: 'value.required' } : context);
                    },
                }
                : undefined,
        });
    }
    return {
        ...options,
        required: constraints.required === true,
        getInputAttrs(name, submission) {
            let id = options.id ?? name;
            let attrs = {
                id,
                name: options.name ?? name,
                type: options.type,
                ...constraints,
            };
            let rawValue = submission?.values[name];
            if (typeof rawValue === 'string')
                attrs.defaultValue = rawValue;
            else if (typeof rawValue === 'boolean')
                attrs.defaultChecked = rawValue;
            if (readFieldErrors(name, submission).length > 0) {
                let errorId = getErrorId(id);
                attrs['aria-invalid'] = 'true';
                attrs['aria-describedby'] = errorId;
                attrs['data-form-error-id'] = errorId;
            }
            return attrs;
        },
        getLabelAttrs(name) {
            return { htmlFor: options.id ?? name };
        },
        getErrorAttrs(name) {
            return { id: getErrorId(options.id ?? name) };
        },
        getFieldErrors(name, submission) {
            return readFieldErrors(name, submission);
        },
        createInputValidator(name) {
            return (control) => {
                let rawValue = options.type === 'checkbox' ? control.checked : control.value;
                let result = validate(rawValue, name);
                control.setCustomValidity(result.issues?.[0]?.message ?? '');
            };
        },
        parse(formData, name) {
            let rawValue = readRawFormValue(formData, options.name ?? name, options.type);
            let result = validate(rawValue, name);
            if (result.issues) {
                return {
                    success: false,
                    issues: result.issues,
                    values: rawValue !== undefined && options.type !== 'password' ? { [name]: rawValue } : {},
                    errors: groupFormErrors(result.issues, new Set([name])),
                };
            }
            // The schema's validator produces its inferred output after successful validation.
            return { success: true, value: result.value };
        },
    };
}
/**
 * Creates a UI form from an optional object schema and configured fields.
 *
 * Fields inherit their schemas from `options.schema`. Fields absent from that schema must provide
 * an inline schema; when `options.schema` is omitted, every field must provide one.
 * Only configured field schemas run during parsing; cross-field validation is caller-owned.
 *
 * @param options The optional backing schema and UI configuration for the included fields.
 * @returns A form definition that derives native attributes and validates `FormData`.
 * @example
 * ```ts
 * import * as s from 'remix/data-schema'
 * import { createForm } from '@remix-run/ui/form'
 *
 * let User = s.object({ name: s.string(), age: s.number() })
 * let UserForm = createForm({
 *   schema: User,
 *   fields: {
 *     name: { label: 'Name', type: 'text' },
 *     age: { label: 'Age', type: 'number' },
 *     confirmation: {
 *       label: 'Confirmation',
 *       type: 'text',
 *       schema: s.string(),
 *     },
 *   },
 * })
 * ```
 */
export function createForm(options) {
    let model = options.schema;
    let configuredFields = options.fields;
    let resolvedFieldEntries = [];
    for (let field of Object.keys(configuredFields)) {
        let fieldOptions = getFieldOptions(configuredFields, field);
        let schema = getFieldSchema(model, field, fieldOptions);
        resolvedFieldEntries.push([field, createField({ ...fieldOptions, schema })]);
    }
    // Every configured field is resolved with its authoritative schema above.
    let fields = Object.fromEntries(resolvedFieldEntries);
    return {
        fields,
        getInputAttrs(field, submission) {
            return getFieldOptions(fields, field).getInputAttrs(field, submission);
        },
        getLabelAttrs(field) {
            return getFieldOptions(fields, field).getLabelAttrs(field);
        },
        getErrorAttrs(field) {
            return getFieldOptions(fields, field).getErrorAttrs(field);
        },
        getFieldErrors(field, submission) {
            return getFieldOptions(fields, field).getFieldErrors(field, submission);
        },
        createInputValidator(field) {
            return getFieldOptions(fields, field).createInputValidator(field);
        },
        parse(formData) {
            let issues = [];
            let valueEntries = [];
            let rawValueEntries = [];
            for (let field of Object.keys(fields)) {
                let fieldOptions = getFieldOptions(fields, field);
                let fieldName = fieldOptions.name ?? field;
                let rawValue = readRawFormValue(formData, fieldName, fieldOptions.type);
                if (rawValue !== undefined && fieldOptions.type !== 'password') {
                    rawValueEntries.push([field, rawValue]);
                }
                let result = fieldOptions.parse(formData, field);
                if (!result.success) {
                    issues.push(...result.issues);
                }
                else {
                    valueEntries.push([field, result.value]);
                }
            }
            if (issues.length > 0) {
                return {
                    success: false,
                    issues,
                    values: Object.fromEntries(rawValueEntries),
                    errors: groupFormErrors(issues, new Set(Object.keys(fields))),
                };
            }
            return {
                success: true,
                value: Object.fromEntries(valueEntries),
            };
        },
    };
}
function getFieldOptions(fields, field) {
    if (!Object.prototype.hasOwnProperty.call(fields, field)) {
        throw new Error(`Unknown form field "${field}"`);
    }
    return fields[field];
}
function getErrorId(fieldId) {
    return `${fieldId}-error`;
}
function readFieldErrors(field, submission) {
    return submission?.errors.fields[field] ?? [];
}
function getFieldSchema(model, field, options) {
    let schema = model && Object.prototype.hasOwnProperty.call(model.shape, field)
        ? model.shape[field]
        : undefined;
    if (schema) {
        if ('schema' in options) {
            throw new Error(`Model field "${field}" cannot override its schema`);
        }
        return schema;
    }
    if ('schema' in options) {
        return options.schema;
    }
    throw new Error(`Ancillary form field "${field}" requires a schema`);
}
function groupFormErrors(issues, fields) {
    let fieldErrors = new Map();
    let formErrors = [];
    for (let issue of issues) {
        let field = getIssueField(issue, fields);
        if (field) {
            let messages = fieldErrors.get(field) ?? [];
            fieldErrors.set(field, [...messages, issue.message]);
        }
        else {
            formErrors.push(issue.message);
        }
    }
    return { fields: Object.fromEntries(fieldErrors), form: formErrors };
}
function getIssueField(issue, fields) {
    let segment = issue.path?.[0];
    let key;
    if (typeof segment === 'string' || typeof segment === 'number' || typeof segment === 'symbol') {
        key = String(segment);
    }
    else if (segment && typeof segment === 'object' && 'key' in segment) {
        key = String(segment.key);
    }
    return key && fields.has(key) ? key : undefined;
}
function readRawFormValue(formData, name, type) {
    if (type === 'checkbox') {
        return formData.has(name);
    }
    let value = formData.get(name);
    return typeof value === 'string' ? value : undefined;
}
function decodeFormValue(value, type) {
    if (type === 'checkbox') {
        return value ?? false;
    }
    if (typeof value !== 'string') {
        return undefined;
    }
    if (type === 'number') {
        if (value.trim() === '') {
            return undefined;
        }
        return Number(value);
    }
    if (value === '') {
        return undefined;
    }
    return value;
}
/**
 * Returns native HTML constraints represented by a schema's recognized checks.
 *
 * Checks without an equivalent native constraint are omitted. Requiredness may evaluate the
 * schema with `undefined` or `false` when metadata alone cannot determine it.
 *
 * @param schema The schema to inspect.
 * @param options The input control receiving the constraints.
 * @returns Constraint attributes that can be spread onto a native `input` element.
 */
export function getConstraints(schema, options) {
    let constraints = {};
    if (options.type === 'number') {
        constraints.step = 'any';
    }
    if (options.type === 'checkbox'
        ? !schemaAcceptsValue(schema, false)
        : !schemaAcceptsUndefined(schema)) {
        constraints.required = true;
    }
    for (let check of getSchemaMetadata(schema).checks) {
        switch (check.code) {
            case 'string.min_length': {
                let minLength = getConstraintValue(check.values, 'min');
                if (minLength !== undefined)
                    constraints.minLength = minLength;
                break;
            }
            case 'string.max_length': {
                let maxLength = getConstraintValue(check.values, 'max');
                if (maxLength !== undefined)
                    constraints.maxLength = maxLength;
                break;
            }
            case 'number.min': {
                let min = getConstraintValue(check.values, 'min');
                if (min !== undefined)
                    constraints.min = min;
                break;
            }
            case 'number.max': {
                let max = getConstraintValue(check.values, 'max');
                if (max !== undefined)
                    constraints.max = max;
                break;
            }
        }
    }
    return constraints;
}
function schemaAcceptsUndefined(schema) {
    let acceptsUndefined = getSchemaMetadata(schema).acceptsUndefined;
    if (acceptsUndefined !== undefined) {
        return acceptsUndefined;
    }
    return !schema['~run'](undefined, { path: [] }).issues;
}
function schemaAcceptsValue(schema, value) {
    return !schema['~run'](value, { path: [] }).issues;
}
function getConstraintValue(values, key) {
    let value = values?.[key];
    return typeof value === 'number' ? value : undefined;
}
//# sourceMappingURL=form.js.map