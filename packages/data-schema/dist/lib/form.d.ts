import type { FormDataEntrySchema, FormDataSource } from './form-data.ts';
import type { ErrorMap, Issue, ParseOptions, Schema, ValidationResult } from './schema.ts';
/** Form control kinds supported by scalar form entries. */
export type FormFieldKind = 'text' | 'password' | 'number' | 'checkbox';
/** Shared submission naming and validation messages for a form field. */
export interface FormFieldOptions {
    /** Submitted entry name, defaulting to the logical object key. */
    name?: string;
    /** Shared field messages; explicit schema messages retain precedence. */
    errorMap?: ErrorMap;
}
/** Empty-string policy for text and password entries. */
export interface FormTextOptions extends FormFieldOptions {
    /** Preserve empty strings instead of decoding them to undefined. */
    empty?: 'preserve' | 'undefined';
}
/** An inspectable scalar form entry with its original value schema. */
export interface FormField<output = unknown, kind extends FormFieldKind = FormFieldKind> extends FormDataEntrySchema<output> {
    /** Scalar entries use the existing single-text extraction mode. */
    readonly kind: 'field';
    /** The form control's decoding and sensitivity behavior. */
    readonly formKind: kind;
    /** Original value validation, run after form decoding. */
    readonly schema: Schema<unknown, output>;
    /** Logical-to-transport name override. */
    readonly name?: string;
    /** Shared schema and native-validation messages. */
    readonly errorMap?: ErrorMap;
    /** Whether an empty text value is preserved. */
    readonly empty?: 'preserve' | 'undefined';
}
/** Form entries, including existing repeated-text and file extraction descriptors. */
export type FormEntries = Readonly<Record<string, FormDataEntrySchema<unknown>>>;
/** Values produced by the form's configured entry schemas. */
export type FormValue<entries extends FormEntries> = {
    [key in keyof entries]: entries[key] extends FormDataEntrySchema<infer output> ? output : never;
};
/** Raw submitted values that can be serialized and restored to native controls. */
export type FormRawValue = string | boolean | ReadonlyArray<string>;
/** Grouped messages for application-owned field and form markup. */
export interface FormErrors {
    /** Messages keyed by logical field name. */
    fields: Readonly<Record<string, ReadonlyArray<string>>>;
    /** Messages not associated with a configured field; absent when there are none. */
    form?: ReadonlyArray<string>;
}
/** Serializable state for rendering a failed submission. */
export interface FormSubmission {
    /** Raw values, with password and file values omitted. */
    values: Readonly<Record<string, FormRawValue>>;
    /** Grouped validation or application messages. */
    errors: FormErrors;
}
/** A validation issue projected to explicitly serializable fields. */
export interface FormIssue {
    /** The validation message. */
    message: string;
    /** A JSON-safe logical path. */
    path?: ReadonlyArray<string | number>;
}
/** A failed submission safe to pass to rendered UI. */
export interface FormFailure extends FormSubmission {
    /** Failure discriminant. */
    success: false;
    /** Validation messages and paths without raw input metadata. */
    issues: ReadonlyArray<FormIssue>;
}
/** The validated form output. */
export interface FormSuccess<value> {
    /** Success discriminant. */
    success: true;
    /** Fully validated and transformed output. */
    value: value;
}
/** A validated output or restorable form failure. */
export type FormParseResult<value> = FormSuccess<value> | FormFailure;
/** A FormData schema retaining its typed entry descriptions for UI adapters. */
export type FormSchema<entries extends FormEntries = FormEntries> = Schema<FormDataSource, FormValue<entries>> & {
    /** Immutable descriptions of the form's submitted fields. */
    readonly entries: Readonly<entries>;
    /**
     * Parses form data, returning validated output or throwing ValidationError.
     * @param value The FormData or URLSearchParams input to validate.
     * @param options Ordinary schema parsing options.
     * @returns The validated and transformed form output.
     */
    parse(value: unknown, options?: ParseOptions): FormValue<entries>;
    /**
     * Parses form data without throwing validation errors and prepares failures for rendering.
     * @param value The FormData or URLSearchParams input to validate.
     * @param options Ordinary schema parsing options.
     * @returns Validated output or restorable values and grouped errors, omitting passwords and files.
     */
    parseSafe(value: unknown, options?: ParseOptions): FormParseResult<FormValue<entries>>;
};
/**
 * Describes a text field, decoding missing and empty entries to undefined by default.
 * @param schema Validation applied to the decoded text value.
 * @param options Entry naming, empty-value policy, and shared messages.
 * @returns An immutable text field description.
 */
export declare function text<output>(schema: Schema<unknown, output>, options?: FormTextOptions): FormField<output, 'text'>;
/**
 * Describes password text that UI submission adapters must omit from restored failures.
 * @param schema Validation applied to the decoded password.
 * @param options Entry naming, empty-value policy, and shared messages.
 * @returns An immutable sensitive password description.
 */
export declare function password<output>(schema: Schema<unknown, output>, options?: FormTextOptions): FormField<output, 'password'>;
/**
 * Describes numeric text, decoding blanks to undefined before numeric coercion and validation.
 * @param schema Validation applied to the coerced number or undefined.
 * @param options Entry naming and shared messages.
 * @returns An immutable numeric field description.
 */
export declare function number<output>(schema: Schema<unknown, output>, options?: FormFieldOptions): FormField<output, 'number'>;
/**
 * Describes a boolean checkbox, decoding presence to true and absence to false.
 * @returns An immutable checkbox description.
 */
export declare function checkbox(): FormField<boolean, 'checkbox'>;
/**
 * Describes a checkbox with application-supplied boolean-state validation.
 * @param schema Validation applied to the checkbox state.
 * @param options Entry naming and shared messages.
 * @returns An immutable checkbox description.
 */
export declare function checkbox<output>(schema: Schema<unknown, output>, options?: FormFieldOptions): FormField<output, 'checkbox'>;
/**
 * Identifies a scalar form description rather than a repeated or file entry.
 * @param entry An entry from an inspectable form schema.
 * @returns Whether the entry has scalar form decoding metadata.
 */
export declare function isFormField(entry: FormDataEntrySchema<unknown>): entry is FormField;
/**
 * Decodes and validates one scalar form value for server or native-control adapters.
 * @param entry The shared field description.
 * @param raw The raw string, checkbox state, or missing value.
 * @param path Logical field path for validation issues.
 * @param options Ordinary schema parsing options.
 * @returns The validated output or ordinary schema issues.
 */
export declare function validateField<output>(entry: FormField<output>, raw: unknown, path?: NonNullable<Issue['path']>, options?: ParseOptions): ValidationResult<output>;
/**
 * Creates an inspectable form schema using ordinary schema validation and parsing.
 * @param entries Scalar form descriptions or existing repeated/file entries.
 * @returns A schema accepting FormData or URLSearchParams with immutable typed entries.
 */
export declare function object<const entries extends FormEntries>(entries: entries): FormSchema<entries>;
/**
 * Parses a form once and adapts failures for safe value restoration and error rendering.
 * @param schema The same inspectable schema consumed by the UI context.
 * @param data The FormData or URLSearchParams input to validate.
 * @param options Ordinary schema parsing options.
 * @returns Validated output or safe raw values and grouped messages.
 */
export declare function parseSafe<entries extends FormEntries>(schema: FormSchema<entries>, data: unknown, options?: ParseOptions): FormParseResult<FormValue<entries>>;
//# sourceMappingURL=form.d.ts.map