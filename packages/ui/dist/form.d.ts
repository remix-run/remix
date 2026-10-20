import type { ErrorMap, InferOutput, Issue, ObjectSchema, ObjectShape, Schema } from '@remix-run/data-schema';
import { attrs, on } from '@remix-run/component';
import type { Dispatched, ElementProps, MixinDescriptor } from '@remix-run/component';
type ValidatableControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
type FormMixin = MixinDescriptor<HTMLFormElement, [], ElementProps>;
type FieldValidator = (control: ValidatableControl) => void;
type FieldErrorMap = (context: {
    code: string;
    defaultMessage: string;
    path?: ReadonlyArray<string>;
    values?: Record<string, unknown>;
    input: unknown;
}) => string | undefined;
interface FieldMessageOptions {
    readonly errorMap?: FieldErrorMap;
}
type FieldMixin = MixinDescriptor<ValidatableControl, [
    getConfig: () => FieldMixinConfig
], ElementProps>;
interface FieldMixinConfig {
    attrs: object;
    validate: FieldValidator;
    field: string;
    errorMap?: FieldErrorMap;
    errorId: string;
    feedback: FieldFeedback;
    onFeedbackChange(previous: FieldState): void;
}
interface FieldFeedback {
    touched: boolean;
    hasServerErrors: boolean;
    errors: ReadonlyArray<string>;
    customErrors: ReadonlyArray<string>;
    customValue?: string;
    refreshControl?: () => void;
}
interface FormDefinitionSource<fields extends Readonly<Record<string, unknown>>, submission> {
    readonly fields: fields & {
        readonly [field in keyof fields]: FieldMessageOptions;
    };
    getInputAttrs<field extends keyof fields & string>(field: field, submission?: submission): object;
    getLabelAttrs<field extends keyof fields & string>(field: field): {
        htmlFor: string;
    };
    createInputValidator<field extends keyof fields & string>(field: field): FieldValidator;
    getErrorAttrs<field extends keyof fields & string>(field: field): {
        id: string;
    };
    getFieldErrors<field extends keyof fields & string>(field: field, submission?: submission): ReadonlyArray<string>;
}
interface FieldDefinitionSource<submission> extends FieldMessageOptions {
    getInputAttrs(name: string, submission?: submission): object;
    getLabelAttrs(name: string): {
        htmlFor: string;
    };
    createInputValidator(name?: string): FieldValidator;
    getErrorAttrs(name: string): {
        id: string;
    };
    getFieldErrors(name: string, submission?: submission): ReadonlyArray<string>;
}
/** Live, read-only feedback for one field. */
export interface FieldState {
    /** Visible client messages or server errors. */
    readonly errors: ReadonlyArray<string>;
    /** Whether feedback was revealed by blur, invalid submission, or editing a server error. */
    readonly touched: boolean;
}
/** Live field feedback with application-owned supplemental errors. */
export interface FieldBinding extends FieldState {
    /**
     * Replaces supplemental errors for the control's current value; `[]` clears them.
     * Updates native validity synchronously without marking the field touched. Messages survive
     * revalidation, but clear on a changed value, non-canceled reset, or new submission.
     * Native/schema errors remain primary. Async work and stale-result protection are caller-owned.
     * @param messages Supplemental messages; empty strings are ignored.
     */
    setCustomErrors(messages: ReadonlyArray<string>): void;
}
/** Related mixins and live state for a single input, select, or textarea. */
export interface FieldMixins extends FieldBinding {
    /**
     * Applies native attributes, validation, interaction state, and error accessibility.
     * @returns A mixin for the native control.
     */
    field(): FieldMixin;
    /**
     * Associates application-owned label markup with the native control.
     * @returns An attribute-only label mixin.
     */
    label(): ReturnType<typeof attrs<HTMLLabelElement>>;
    /**
     * Identifies application-owned error markup without choosing its content or role.
     * @returns An attribute-only error mixin.
     */
    error(): ReturnType<typeof attrs<Element>>;
}
/** Naming, current submission, and render notification for a standalone field. */
export interface FieldMixinsOptions<submission> extends FormMixinsOptions<submission> {
    /** Logical field name, used to read submission values and errors. */
    name: string;
}
/** Dynamic submission data for setup-scoped form mixins. */
export interface FormMixinsOptions<submission> {
    /** Reads the current submission when rendering mixins or reading errors; does not subscribe. */
    getSubmission?: () => submission | undefined;
    /** Requests rendering when visible errors or touched state change. */
    onChange?: () => void;
}
/** Related validation mixins bound to one form definition. */
export interface FormMixins<fields extends Readonly<Record<string, unknown>>> {
    /** Stable field bindings; read live properties during rendering and supply custom errors. */
    readonly fields: {
        readonly [field in keyof fields & string]: FieldBinding;
    };
    /** Stable, read-only object of current visible messages; read field arrays during rendering. */
    readonly errors: {
        readonly [field in keyof fields & string]: ReadonlyArray<string>;
    };
    /**
     * Enhances the form's unmanaged native controls without duplicating managed input behavior.
     *
     * @returns A mixin for the native form element.
     */
    form(): FormMixin;
    /**
     * Alias for `field()`; applies control attributes, validation, and error accessibility.
     *
     * @param field The projected field name.
     * @returns A mixin for the field's native input.
     */
    input<field extends keyof fields & string>(field: field): FieldMixin;
    /**
     * Applies control attributes, validation, touched state, and error accessibility.
     * @param field The projected field name.
     * @returns A mixin for the field's native control.
     */
    field<field extends keyof fields & string>(field: field): FieldMixin;
    /**
     * Associates application-owned label markup with the field's native control.
     * @param field The projected field name.
     * @returns An attribute-only label mixin.
     */
    label<field extends keyof fields & string>(field: field): ReturnType<typeof attrs<HTMLLabelElement>>;
    /**
     * Applies the generated error-element id without controlling content, visibility, or role.
     *
     * @param field The projected field name.
     * @returns An attribute-only mixin for application-owned error markup.
     */
    error<field extends keyof fields & string>(field: field): ReturnType<typeof attrs<Element>>;
}
declare const INPUT_VALIDATION_EVENT: 'rmx:input-validation';
declare global {
    interface HTMLElementEventMap {
        [INPUT_VALIDATION_EVENT]: InputValidationEvent;
    }
}
/** Presentation-ready validation state for a model-backed input. */
export interface InputValidationState extends FieldState {
    /** The projected field name, independent of an overridden input name or id. */
    readonly field: string;
    /** The generated id to apply to the application's error element. */
    readonly errorId: string;
}
/** A bubbling notification for rendering application-owned field errors. */
export declare class InputValidationEvent extends Event implements InputValidationState {
    /** The projected field name. */
    readonly field: string;
    /** The id of the application's error element. */
    readonly errorId: string;
    /** The errors to display for this field. */
    readonly errors: ReadonlyArray<string>;
    /** Whether client feedback has been revealed for this input. */
    readonly touched: boolean;
    /**
     * Creates a validation notification.
     *
     * @param state The field's presentation-ready validation state.
     */
    constructor(state: InputValidationState);
}
/**
 * Enhances unmanaged native controls with touched state and accessible invalid attributes.
 *
 * @returns A mixin for a native form element.
 */
export declare function form(): FormMixin;
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
export declare function createFieldMixins<submission>(fieldDefinition: FieldDefinitionSource<submission>, options: FieldMixinsOptions<submission>): FieldMixins;
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
export declare function createFormMixins<fields extends Readonly<Record<string, unknown>>, submission>(formDefinition: FormDefinitionSource<fields, submission>, options?: FormMixinsOptions<submission>): FormMixins<fields>;
/**
 * Observes field feedback without taking ownership of its markup or disabling default behavior.
 *
 * @param handler Receives the field, error element id, visible errors, and touched state.
 * @param captureBoolean Whether to listen during capture (false by default).
 * @returns An event mixin for an input or an ancestor such as its form.
 */
export declare function onInputValidation<target extends HTMLElement>(handler: (event: Dispatched<InputValidationEvent, target>, signal: AbortSignal) => void | Promise<void>, captureBoolean?: boolean): ReturnType<typeof on<target, typeof INPUT_VALIDATION_EVENT>>;
/**
 * Native HTML constraints that can be derived from a schema's checks.
 */
export interface SchemaConstraints {
    /** Whether the input must contain a value or a checkbox must be checked. */
    required?: true;
    /** The minimum text length accepted by the schema. */
    minLength?: number;
    /** The maximum text length accepted by the schema. */
    maxLength?: number;
    /** The minimum numeric value accepted by the schema. */
    min?: number;
    /** The maximum numeric value accepted by the schema. */
    max?: number;
    /** The interval accepted by a numeric input. */
    step?: number | 'any';
}
/**
 * Input control context used to derive native HTML constraints.
 */
export interface GetConstraintsOptions {
    /** The native input type and its corresponding empty-value semantics. */
    type: 'checkbox' | 'email' | 'number' | 'password' | 'text' | 'url';
}
/**
 * Native input types supported by a form field.
 */
export type FormInputType = GetConstraintsOptions['type'];
/**
 * UI configuration and message customization for a projected model field.
 */
export interface FormFieldOptions {
    /** The visible label text for the field. */
    label: string;
    /** The native input type and corresponding `FormData` decoder. */
    type: FormInputType;
    /** The submitted field name. (defaults to the logical field name) */
    name?: string;
    /** The DOM id used by the control, label, and error. (defaults to the logical field name) */
    id?: string;
    /**
     * Customizes schema failures during parsing and supported native failures in the browser.
     * Return `undefined` to keep the default. Required empty values use `value.required`;
     * other failures use schema/domain codes. Supplemental `setCustomErrors` are not mapped.
     * Explicit refinement messages and uncoded checks bypass the map, matching schema parsing.
     */
    errorMap?: ErrorMap;
}
/**
 * UI configuration and validation for a reusable field.
 */
export interface FieldOptions<schema extends Schema<unknown, unknown>> extends FormFieldOptions {
    /** The authoritative schema for the field value. */
    schema: schema;
}
/** UI configuration and validation for a field absent from the backing model. */
export interface AncillaryFormFieldOptions<schema extends Schema<any, unknown>> extends FieldOptions<schema> {
}
/**
 * Native attributes derived for a projected model field.
 */
export interface InputAttributes<type extends FormInputType = FormInputType> {
    /** The DOM id used by the field label and error message. */
    id: string;
    /** The submitted field name. */
    name: string;
    /** The native input type. */
    type: type;
    /** Whether the input must contain a value. */
    required?: true;
    /** The minimum text length accepted by the model. */
    minLength?: number;
    /** The maximum text length accepted by the model. */
    maxLength?: number;
    /** The minimum numeric value accepted by the model. */
    min?: number;
    /** The maximum numeric value accepted by the model. */
    max?: number;
    /** The interval accepted by a numeric input. */
    step?: number | 'any';
    /** The submitted text value from a failed validation result. */
    defaultValue?: string;
    /** The submitted checkbox state from a failed validation result. */
    defaultChecked?: boolean;
    /** Whether server or native validation has marked the input invalid. */
    'aria-invalid'?: 'true';
    /** The id of the field error describing the input. */
    'aria-describedby'?: string;
    /** The server-rendered error element to clear after the input changes. */
    'data-form-error-id'?: string;
}
/**
 * A raw form value that can be serialized and restored to a native input.
 */
export type FormRawValue = boolean | string;
/**
 * A failed form validation result suitable for returning to a rendered route.
 */
export interface FormFailure extends FormSubmission {
    /** Discriminates failed results from successful results. */
    success: false;
    /** The original validation issues. */
    issues: ReadonlyArray<Issue>;
}
/**
 * Serializable form state used to restore values and errors in rendered UI.
 */
export type FormSubmission = {
    /** Submitted values keyed by logical form field name. Password values are omitted. */
    values: Readonly<Record<string, FormRawValue>>;
    /** Validation messages grouped for rendering. */
    errors: FormErrors;
};
/**
 * A successfully decoded and validated form value.
 */
export interface FormSuccess<value> {
    /** Discriminates successful results from failed results. */
    success: true;
    /** The typed form value. */
    value: value;
}
/**
 * The result of decoding and validating submitted form data.
 */
export type FormParseResult<value> = FormSuccess<value> | FormFailure;
/**
 * Serializable validation errors grouped by field and form.
 */
export type FormErrors = {
    /** Validation messages keyed by logical form field name. */
    fields: Readonly<Record<string, ReadonlyArray<string>>>;
    /** Validation messages that do not belong to one form field. */
    form: ReadonlyArray<string>;
};
/**
 * Native attributes that associate a label with its input.
 */
export interface LabelAttributes {
    /** The id of the labeled input. */
    htmlFor: string;
}
/**
 * Native attributes that identify a field error.
 */
export interface ErrorAttributes {
    /** The id referenced by an invalid input's `aria-describedby`. */
    id: string;
}
/**
 * The native input state used for client-side schema validation.
 */
export interface InputValidationTarget {
    /** The input's current string value. */
    readonly value: string;
    /** Whether a checkbox input is currently checked; absent for selects and textareas. */
    readonly checked?: boolean;
    /** Sets or clears the input's custom Constraint Validation API message. */
    setCustomValidity(message: string): void;
}
type AnyFormFieldOptions = FormFieldOptions | AncillaryFormFieldOptions<Schema<any, unknown>>;
type FormFields = Record<string, AnyFormFieldOptions>;
type ResolvedFormFields<shape extends ObjectShape, fields extends FormFields> = {
    readonly [field in keyof fields]: Omit<fields[field], 'required'> & FieldDefinition<FormFieldSchema<shape, fields, field>, fields[field]['type']>;
};
type ValidFormFields<shape extends ObjectShape, field extends string> = {
    [key in field]: key extends keyof shape ? FormFieldOptions & {
        schema?: never;
    } : AncillaryFormFieldOptions<Schema<any, unknown>>;
};
type FormFieldSchema<shape extends ObjectShape, fields extends FormFields, key extends keyof fields> = key extends keyof shape ? shape[key] : fields[key] extends AncillaryFormFieldOptions<infer schema> ? schema : never;
type FormValue<shape extends ObjectShape, fields extends FormFields> = {
    -readonly [key in keyof fields]: InferOutput<FormFieldSchema<shape, fields, key>>;
};
/**
 * Configured schema-backed fields with native attributes and server parsing.
 */
export interface FormDefinition<shape extends ObjectShape, fields extends FormFields> {
    /** The field configuration in render order, including schema-derived requiredness. */
    readonly fields: ResolvedFormFields<shape, fields>;
    /**
     * Derives native attributes for one configured field.
     *
     * @param field The logical field name.
     * @param submission A failed form result whose values and errors should be restored.
     * @returns Attributes that can be spread onto a native `input` element.
     */
    getInputAttrs<field extends keyof fields & string>(field: field, submission?: FormSubmission): InputAttributes<fields[field]['type']>;
    /**
     * Associates a native label with one projected field.
     *
     * @param field The projected field name.
     * @returns Attributes that can be spread onto a native `label` element.
     */
    getLabelAttrs<field extends keyof fields & string>(field: field): LabelAttributes;
    /**
     * Identifies the error element for one projected field.
     *
     * @param field The projected field name.
     * @returns Attributes that can be spread onto the field's error element.
     */
    getErrorAttrs<field extends keyof fields & string>(field: field): ErrorAttributes;
    /**
     * Reads the server validation messages for one projected field.
     *
     * @param field The projected field name.
     * @param submission A failed form result.
     * @returns The field's validation messages, or an empty array.
     */
    getFieldErrors<field extends keyof fields & string>(field: field, submission?: FormSubmission): ReadonlyArray<string>;
    /**
     * Creates a synchronous client-side validator for one projected field.
     *
     * The validator decodes the current input state like the form's `parse()` and sets the first schema
     * issue as the input's custom Constraint Validation API message. A valid value clears any prior
     * custom message. Messages use the field's `errorMap` when configured.
     *
     * @param field The projected field name.
     * @returns A validator that accepts a native input or compatible input state.
     */
    createInputValidator<field extends keyof fields & string>(field: field): (input: InputValidationTarget) => void;
    /**
     * Decodes and validates configured fields, without running backing object-level rules.
     *
     * @param formData The submitted form payload.
     * @returns Typed field values or a serializable failure with values and grouped errors.
     */
    parse(formData: FormData): FormParseResult<FormValue<shape, fields>>;
}
/** A reusable schema-backed field, independent of any form or browser state. */
export interface FieldDefinition<schema extends Schema<unknown, unknown>, type extends FormInputType> extends FieldOptions<schema> {
    /** The native input type and form-value decoder. */
    readonly type: type;
    /** Whether the field requires a value. */
    readonly required: boolean;
    /**
     * Derives native control attributes and restores submitted values and errors.
     * @param name Logical field name, used when no explicit name or id is configured.
     * @param submission Failed submission to restore.
     * @returns Native control attributes.
     */
    getInputAttrs(name: string, submission?: FormSubmission): InputAttributes<type>;
    /**
     * Associates a label with this field.
     * @param name Logical field name.
     * @returns Label attributes.
     */
    getLabelAttrs(name: string): LabelAttributes;
    /**
     * Identifies the application's error element.
     * @param name Logical field name.
     * @returns Error attributes.
     */
    getErrorAttrs(name: string): ErrorAttributes;
    /**
     * Reads server validation messages.
     * @param name Logical field name.
     * @param submission Failed submission to read.
     * @returns Visible server messages.
     */
    getFieldErrors(name: string, submission?: FormSubmission): ReadonlyArray<string>;
    /**
     * Creates a synchronous schema validator using the field's `errorMap` and native custom validity.
     * @param name Logical field name used in validation issue paths (optional).
     * @returns A validator for an input, select, or textarea.
     */
    createInputValidator(name?: string): (control: InputValidationTarget) => void;
    /**
     * Decodes and validates this field from a form payload.
     * @param formData Submitted payload.
     * @param name Logical field name used for values and error paths.
     * @returns A typed value or a serializable failed submission.
     */
    parse(formData: FormData, name: string): FormParseResult<InferOutput<schema>>;
}
/**
 * Creates a reusable field definition with native constraints and server parsing.
 * @param options The field's schema and UI metadata; names default when the field is bound.
 * @returns A stateless field definition that can be used independently or composed into a form.
 */
export declare function createField<schema extends Schema<unknown, unknown>, const type extends FormInputType>(options: FieldOptions<schema> & {
    type: type;
}): FieldDefinition<schema, type>;
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
export declare function createForm<field extends string, const fields extends FormFields & Record<field, AnyFormFieldOptions>, shape extends ObjectShape = Record<never, never>>(options: {
    schema?: ObjectSchema<shape>;
    fields: fields & ValidFormFields<NoInfer<shape>, field>;
}): FormDefinition<shape, fields>;
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
export declare function getConstraints<input, output>(schema: Schema<input, output>, options: GetConstraintsOptions): SchemaConstraints;
export {};
