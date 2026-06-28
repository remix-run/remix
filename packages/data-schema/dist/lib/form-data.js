import { createIssue, createSchema, fail } from "./schema.js";
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
export function object(schema) {
    return createSchema(function validate(value, context) {
        if (!isFormDataSource(value)) {
            return fail('Expected FormData or URLSearchParams', context.path, {
                code: 'type.form_data_source',
                input: value,
                parseOptions: context.options,
            });
        }
        let abortEarly = shouldAbortEarly(context.options);
        let issues = [];
        let output = {};
        for (let [key, entrySchema] of Object.entries(schema)) {
            let result = parseField(value, key, entrySchema, context);
            if ('issues' in result) {
                if (abortEarly) {
                    return { issues: result.issues };
                }
                issues.push(...result.issues);
                continue;
            }
            output[key] = result.value;
        }
        if (issues.length > 0) {
            return { issues };
        }
        return { value: output };
    });
}
/**
 * Creates a schema entry for a single text field from `FormData` or `URLSearchParams`.
 *
 * @param schema The schema used to validate the parsed field value.
 * @param options Parsing options for the field.
 * @returns A field schema entry for use with `object()`.
 */
export function field(schema, options) {
    return {
        kind: 'field',
        name: options?.name,
        schema,
    };
}
/**
 * Creates a schema entry for repeated text fields from `FormData` or `URLSearchParams`.
 *
 * @param schema The schema used to validate the parsed field values.
 * @param options Parsing options for the field.
 * @returns A field schema entry for use with `object()`.
 */
export function fields(schema, options) {
    return {
        kind: 'fields',
        name: options?.name,
        schema,
    };
}
/**
 * Creates a schema entry for a single file field from `FormData`.
 *
 * @param schema The schema used to validate the parsed file value.
 * @param options Parsing options for the field.
 * @returns A file schema entry for use with `object()`.
 */
export function file(schema, options) {
    return {
        kind: 'file',
        name: options?.name,
        schema,
    };
}
/**
 * Creates a schema entry for repeated file fields from `FormData`.
 *
 * @param schema The schema used to validate the parsed file values.
 * @param options Parsing options for the field.
 * @returns A file schema entry for use with `object()`.
 */
export function files(schema, options) {
    return {
        kind: 'files',
        name: options?.name,
        schema,
    };
}
function parseField(formData, key, entrySchema, context) {
    let fieldName = entrySchema.name ?? key;
    let keyPath = withPath(context.path, key);
    switch (entrySchema.kind) {
        case 'field': {
            let value = formData.get(fieldName);
            if (value instanceof Blob) {
                return {
                    issues: [createIssue(`Expected text field "${fieldName}"`, keyPath)],
                };
            }
            return validateParsedValue(keyPath, entrySchema.schema, value ?? undefined, context.options);
        }
        case 'fields': {
            let values = formData.getAll(fieldName);
            let parsedValues = [];
            let issues = [];
            values.forEach((value, index) => {
                if (value instanceof Blob) {
                    issues.push(createIssue(`Expected text field "${fieldName}"`, withPath(keyPath, index)));
                }
                else {
                    parsedValues.push(value);
                }
            });
            if (issues.length > 0) {
                return { issues };
            }
            return validateParsedValue(keyPath, entrySchema.schema, parsedValues, context.options);
        }
        case 'file': {
            let value = formData.get(fieldName);
            if (value != null && !(value instanceof Blob)) {
                return {
                    issues: [createIssue(`Expected file field "${fieldName}"`, keyPath)],
                };
            }
            return validateParsedValue(keyPath, entrySchema.schema, value ?? undefined, context.options);
        }
        case 'files': {
            let values = formData.getAll(fieldName);
            let parsedValues = [];
            let issues = [];
            values.forEach((value, index) => {
                if (!(value instanceof Blob)) {
                    issues.push(createIssue(`Expected file field "${fieldName}"`, withPath(keyPath, index)));
                }
                else {
                    parsedValues.push(value);
                }
            });
            if (issues.length > 0) {
                return { issues };
            }
            return validateParsedValue(keyPath, entrySchema.schema, parsedValues, context.options);
        }
    }
}
function validateParsedValue(path, schema, value, options) {
    let result = schema['~run'](value, { path, options });
    if (result.issues) {
        return { issues: result.issues };
    }
    return {
        value: result.value,
    };
}
function shouldAbortEarly(options) {
    let libraryAbortEarly = options?.libraryOptions
        ?.abortEarly;
    return Boolean(options?.abortEarly ?? libraryAbortEarly);
}
function withPath(path, key) {
    return path.length === 0 ? [key] : [...path, key];
}
function isFormDataSource(value) {
    return value instanceof FormData || value instanceof URLSearchParams;
}
