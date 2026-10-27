import { object as formDataObject } from './form-data.js';
import { boolean, createSchema, parse as parseValue, parseSafe as parseValueSafe, } from './schema.js';
import { coerceNumber } from './coerce.js';
const numeric = coerceNumber();
/**
 * Describes a text field, decoding missing and empty entries to undefined by default.
 * @param schema Validation applied to the decoded text value.
 * @param options Entry naming, empty-value policy, and shared messages.
 * @returns An immutable text field description.
 */
export function text(schema, options = {}) {
    return Object.freeze({ ...options, kind: 'field', formKind: 'text', schema });
}
/**
 * Describes password text that UI submission adapters must omit from restored failures.
 * @param schema Validation applied to the decoded password.
 * @param options Entry naming, empty-value policy, and shared messages.
 * @returns An immutable sensitive password description.
 */
export function password(schema, options = {}) {
    return Object.freeze({ ...options, kind: 'field', formKind: 'password', schema });
}
/**
 * Describes numeric text, decoding blanks to undefined before numeric coercion and validation.
 * @param schema Validation applied to the coerced number or undefined.
 * @param options Entry naming and shared messages.
 * @returns An immutable numeric field description.
 */
export function number(schema, options = {}) {
    return Object.freeze({ ...options, kind: 'field', formKind: 'number', schema });
}
export function checkbox(schema = boolean(), options = {}) {
    return Object.freeze({ ...options, kind: 'field', formKind: 'checkbox', schema });
}
/**
 * Identifies a scalar form description rather than a repeated or file entry.
 * @param entry An entry from an inspectable form schema.
 * @returns Whether the entry has scalar form decoding metadata.
 */
export function isFormField(entry) {
    return ('formKind' in entry &&
        (entry.formKind === 'text' ||
            entry.formKind === 'password' ||
            entry.formKind === 'number' ||
            entry.formKind === 'checkbox'));
}
/**
 * Decodes and validates one scalar form value for server or native-control adapters.
 * @param entry The shared field description.
 * @param raw The raw string, checkbox state, or missing value.
 * @param path Logical field path for validation issues.
 * @param options Ordinary schema parsing options.
 * @returns The validated output or ordinary schema issues.
 */
export function validateField(entry, raw, path = [], options) {
    let value = raw;
    if (entry.formKind === 'checkbox') {
        value = typeof raw === 'boolean' ? raw : raw !== undefined;
    }
    else if (typeof raw === 'string') {
        if (entry.formKind === 'number') {
            if (raw.trim() === '')
                value = undefined;
            else {
                let result = numeric['~run'](raw, { path, options: messageOptions(entry, raw, options) });
                if (result.issues)
                    return { issues: result.issues };
                value = result.value;
            }
        }
        else if (raw === '' && entry.empty !== 'preserve')
            value = undefined;
    }
    return entry.schema['~run'](value, { path, options: messageOptions(entry, value, options) });
}
function messageOptions(entry, value, options) {
    if (!entry.errorMap)
        return options;
    return {
        ...options,
        errorMap(context) {
            let missing = value === undefined || (entry.formKind === 'checkbox' && value === false);
            return (entry.errorMap?.(missing ? { ...context, code: 'value.required' } : context) ??
                options?.errorMap?.(context));
        },
    };
}
/**
 * Creates an inspectable form schema using ordinary schema validation and parsing.
 * @param entries Scalar form descriptions or existing repeated/file entries.
 * @returns A schema accepting FormData or URLSearchParams with immutable typed entries.
 */
export function object(entries) {
    let descriptions = Object.fromEntries(Object.entries(entries).map(([key, entry]) => [
        key,
        Object.isFrozen(entry) ? entry : Object.freeze({ ...entry }),
    ]));
    let extracted = Object.fromEntries(Object.entries(descriptions).map(([key, entry]) => [
        key,
        isFormField(entry)
            ? {
                kind: 'field',
                name: entry.name,
                schema: createSchema((value, context) => validateField(entry, value, context.path, context.options)),
            }
            : entry,
    ]));
    // Each extracted entry delegates to the corresponding original schema, preserving its output.
    let schema = Object.defineProperties(formDataObject(extracted), {
        entries: { value: Object.freeze(descriptions), enumerable: true },
        parse: {
            value(value, options) {
                return parseValue(schema, value, options);
            },
        },
        parseSafe: {
            value(value, options) {
                return parseSafe(schema, value, options);
            },
        },
    });
    return schema;
}
/**
 * Parses a form once and adapts failures for safe value restoration and error rendering.
 * @param schema The same inspectable schema consumed by the UI context.
 * @param data The FormData or URLSearchParams input to validate.
 * @param options Ordinary schema parsing options.
 * @returns Validated output or safe raw values and grouped messages.
 */
export function parseSafe(schema, data, options) {
    let result = parseValueSafe(schema, data, options);
    if (result.success)
        return result;
    let values = [];
    if (data instanceof FormData || data instanceof URLSearchParams) {
        for (let [key, entry] of Object.entries(schema.entries)) {
            let name = entry.name ?? key;
            if (isFormField(entry) && entry.formKind === 'password')
                continue;
            if (isFormField(entry) && entry.formKind === 'checkbox')
                values.push([key, data.has(name)]);
            else if (entry.kind === 'field') {
                let value = data.get(name);
                if (typeof value === 'string')
                    values.push([key, value]);
            }
            else if (entry.kind === 'fields') {
                let raw = data.getAll(name);
                if (raw.every((value) => typeof value === 'string'))
                    values.push([key, raw]);
            }
        }
    }
    let issues = result.issues.map(safeIssue);
    let grouped = new Map();
    let form = [];
    for (let issue of issues) {
        let key = issue.path?.[0];
        if (typeof key === 'string' && Object.hasOwn(schema.entries, key)) {
            let messages = grouped.get(key) ?? [];
            messages.push(issue.message);
            grouped.set(key, messages);
        }
        else
            form.push(issue.message);
    }
    return {
        success: false,
        issues,
        values: Object.fromEntries(values),
        errors: { fields: Object.fromEntries(grouped), ...(form.length > 0 ? { form } : {}) },
    };
}
function safeIssue(issue) {
    return {
        message: issue.message,
        ...(issue.path
            ? {
                path: issue.path.map((segment) => {
                    let key = typeof segment === 'object' ? segment.key : segment;
                    return typeof key === 'number' ? key : String(key);
                }),
            }
            : {}),
    };
}
