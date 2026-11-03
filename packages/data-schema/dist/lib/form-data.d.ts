import type { InferOutput, Schema } from './schema.ts';
type FormDataEntryKind = 'field' | 'fields' | 'file' | 'files';
/**
 * A Standard Schema-compatible input type for form-like data containers.
 */
export type FormDataSource = FormData | URLSearchParams;
/**
 * A schema entry that reads one or more values from `FormData` or `URLSearchParams` and validates
 * them.
 */
export interface FormDataEntrySchema<output> {
    /** The parsing mode used to read values from the input object. */
    kind: FormDataEntryKind;
    /** The form field name to read. Defaults to the object key passed to `object()`. */
    name?: string;
    /** The schema used to validate the parsed value or values. */
    schema: Schema<any, output>;
}
/**
 * Options for parsing a single text field from `FormData` or `URLSearchParams`.
 */
export interface FormDataFieldOptions {
    /** The form field name to read. Defaults to the object key passed to `object()`. */
    name?: string;
}
/**
 * Options for parsing repeated text fields from `FormData` or `URLSearchParams`.
 */
export interface FormDataFieldsOptions {
    /** The form field name to read. Defaults to the object key passed to `object()`. */
    name?: string;
}
/**
 * Options for parsing a single file field from `FormData`.
 */
export interface FormDataFileOptions {
    /** The form field name to read. Defaults to the object key passed to `object()`. */
    name?: string;
}
/**
 * Options for parsing repeated file fields from `FormData`.
 */
export interface FormDataFilesOptions {
    /** The form field name to read. Defaults to the object key passed to `object()`. */
    name?: string;
}
/**
 * A schema-like object that describes the fields to parse from `FormData` or `URLSearchParams`.
 */
export type FormDataSchema = Record<string, FormDataEntrySchema<any>>;
/**
 * A Standard Schema-compatible schema that validates a `FormData` or `URLSearchParams` object.
 */
export type FormDataObjectSchema<schema extends FormDataSchema> = Schema<FormDataSource, ParsedFormData<schema>>;
/**
 * The typed result produced by `object()` for a given form-data shape.
 */
export type ParsedFormData<schema extends FormDataSchema> = {
    [key in keyof schema]: schema[key] extends FormDataEntrySchema<infer output> ? output : never;
};
/**
 * Creates a Standard Schema-compatible schema that reads typed values from a `FormData` or
 * `URLSearchParams` object.
 *
 * Use the returned schema with `parse()` or `parseSafe()` from `@remix-run/data-schema`.
 *
 * @param schema The form-data shape describing the fields to read and validate.
 * @returns A schema that validates a `FormData` or `URLSearchParams` object and produces typed
 * output.
 */
export declare function object<schema extends FormDataSchema>(schema: schema): FormDataObjectSchema<schema>;
/**
 * Creates a schema entry for a single text field from `FormData` or `URLSearchParams`.
 *
 * @param schema The schema used to validate the parsed field value.
 * @param options Parsing options for the field.
 * @returns A field schema entry for use with `object()`.
 */
export declare function field<schema extends Schema<any, any>>(schema: schema, options?: FormDataFieldOptions): FormDataEntrySchema<InferOutput<schema>>;
/**
 * Creates a schema entry for repeated text fields from `FormData` or `URLSearchParams`.
 *
 * @param schema The schema used to validate the parsed field values.
 * @param options Parsing options for the field.
 * @returns A field schema entry for use with `object()`.
 */
export declare function fields<schema extends Schema<any, any>>(schema: schema, options?: FormDataFieldsOptions): FormDataEntrySchema<InferOutput<schema>>;
/**
 * Creates a schema entry for a single file field from `FormData`.
 *
 * @param schema The schema used to validate the parsed file value.
 * @param options Parsing options for the field.
 * @returns A file schema entry for use with `object()`.
 */
export declare function file<schema extends Schema<any, any>>(schema: schema, options?: FormDataFileOptions): FormDataEntrySchema<InferOutput<schema>>;
/**
 * Creates a schema entry for repeated file fields from `FormData`.
 *
 * @param schema The schema used to validate the parsed file values.
 * @param options Parsing options for the field.
 * @returns A file schema entry for use with `object()`.
 */
export declare function files<schema extends Schema<any, any>>(schema: schema, options?: FormDataFilesOptions): FormDataEntrySchema<InferOutput<schema>>;
export {};
//# sourceMappingURL=form-data.d.ts.map