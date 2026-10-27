import { object as formDataObject } from './form-data.ts'
import type { FormDataEntrySchema, FormDataSource } from './form-data.ts'
import {
  boolean,
  createSchema,
  parse as parseValue,
  parseSafe as parseValueSafe,
} from './schema.ts'
import type { ErrorMap, Issue, ParseOptions, Schema, ValidationResult } from './schema.ts'
import { coerceNumber } from './coerce.ts'

/** Form control kinds supported by scalar form entries. */
export type FormFieldKind = 'text' | 'password' | 'number' | 'checkbox'

/** Shared submission naming and validation messages for a form field. */
export interface FormFieldOptions {
  /** Submitted entry name, defaulting to the logical object key. */
  name?: string
  /** Shared field messages; explicit schema messages retain precedence. */
  errorMap?: ErrorMap
}

/** Empty-string policy for text and password entries. */
export interface FormTextOptions extends FormFieldOptions {
  /** Preserve empty strings instead of decoding them to undefined. */
  empty?: 'preserve' | 'undefined'
}

/** An inspectable scalar form entry with its original value schema. */
export interface FormField<
  output = unknown,
  kind extends FormFieldKind = FormFieldKind,
> extends FormDataEntrySchema<output> {
  /** Scalar entries use the existing single-text extraction mode. */
  readonly kind: 'field'
  /** The form control's decoding and sensitivity behavior. */
  readonly formKind: kind
  /** Original value validation, run after form decoding. */
  readonly schema: Schema<unknown, output>
  /** Logical-to-transport name override. */
  readonly name?: string
  /** Shared schema and native-validation messages. */
  readonly errorMap?: ErrorMap
  /** Whether an empty text value is preserved. */
  readonly empty?: 'preserve' | 'undefined'
}

/** Form entries, including existing repeated-text and file extraction descriptors. */
export type FormEntries = Readonly<Record<string, FormDataEntrySchema<unknown>>>

/** Values produced by the form's configured entry schemas. */
export type FormValue<entries extends FormEntries> = {
  [key in keyof entries]: entries[key] extends FormDataEntrySchema<infer output> ? output : never
}

/** Raw submitted values that can be serialized and restored to native controls. */
export type FormRawValue = string | boolean | ReadonlyArray<string>

/** Grouped messages for application-owned field and form markup. */
export interface FormErrors {
  /** Messages keyed by logical field name. */
  fields: Readonly<Record<string, ReadonlyArray<string>>>
  /** Messages not associated with a configured field. */
  form: ReadonlyArray<string>
}

/** Serializable state for rendering a failed submission. */
export interface FormSubmission {
  /** Raw values, with password and file values omitted. */
  values: Readonly<Record<string, FormRawValue>>
  /** Grouped validation or application messages. */
  errors: FormErrors
}

/** A validation issue projected to explicitly serializable fields. */
export interface FormIssue {
  /** The validation message. */
  message: string
  /** A JSON-safe logical path. */
  path?: ReadonlyArray<string | number>
}

/** A failed submission safe to pass to rendered UI. */
export interface FormFailure extends FormSubmission {
  /** Failure discriminant. */
  success: false
  /** Validation messages and paths without raw input metadata. */
  issues: ReadonlyArray<FormIssue>
}

/** The validated form output. */
export interface FormSuccess<value> {
  /** Success discriminant. */
  success: true
  /** Fully validated and transformed output. */
  value: value
}

/** A validated output or restorable form failure. */
export type FormParseResult<value> = FormSuccess<value> | FormFailure

/** A FormData schema retaining its typed entry descriptions for UI adapters. */
export type FormSchema<entries extends FormEntries = FormEntries> = Schema<
  FormDataSource,
  FormValue<entries>
> & {
  /** Immutable descriptions of the form's submitted fields. */
  readonly entries: Readonly<entries>
  /**
   * Parses form data, returning validated output or throwing ValidationError.
   * @param value The FormData or URLSearchParams input to validate.
   * @param options Ordinary schema parsing options.
   * @returns The validated and transformed form output.
   */
  parse(value: unknown, options?: ParseOptions): FormValue<entries>
  /**
   * Parses form data without throwing validation errors and prepares failures for rendering.
   * @param value The FormData or URLSearchParams input to validate.
   * @param options Ordinary schema parsing options.
   * @returns Validated output or restorable values and grouped errors, omitting passwords and files.
   */
  parseSafe(value: unknown, options?: ParseOptions): FormParseResult<FormValue<entries>>
}

const numeric = coerceNumber()

/**
 * Describes a text field, decoding missing and empty entries to undefined by default.
 * @param schema Validation applied to the decoded text value.
 * @param options Entry naming, empty-value policy, and shared messages.
 * @returns An immutable text field description.
 */
export function text<output>(
  schema: Schema<unknown, output>,
  options: FormTextOptions = {},
): FormField<output, 'text'> {
  return Object.freeze({ ...options, kind: 'field', formKind: 'text', schema })
}

/**
 * Describes password text that UI submission adapters must omit from restored failures.
 * @param schema Validation applied to the decoded password.
 * @param options Entry naming, empty-value policy, and shared messages.
 * @returns An immutable sensitive password description.
 */
export function password<output>(
  schema: Schema<unknown, output>,
  options: FormTextOptions = {},
): FormField<output, 'password'> {
  return Object.freeze({ ...options, kind: 'field', formKind: 'password', schema })
}

/**
 * Describes numeric text, decoding blanks to undefined before numeric coercion and validation.
 * @param schema Validation applied to the coerced number or undefined.
 * @param options Entry naming and shared messages.
 * @returns An immutable numeric field description.
 */
export function number<output>(
  schema: Schema<unknown, output>,
  options: FormFieldOptions = {},
): FormField<output, 'number'> {
  return Object.freeze({ ...options, kind: 'field', formKind: 'number', schema })
}

/**
 * Describes a boolean checkbox, decoding presence to true and absence to false.
 * @returns An immutable checkbox description.
 */
export function checkbox(): FormField<boolean, 'checkbox'>
/**
 * Describes a checkbox with application-supplied boolean-state validation.
 * @param schema Validation applied to the checkbox state.
 * @param options Entry naming and shared messages.
 * @returns An immutable checkbox description.
 */
export function checkbox<output>(
  schema: Schema<unknown, output>,
  options?: FormFieldOptions,
): FormField<output, 'checkbox'>
export function checkbox(
  schema: Schema<unknown, unknown> = boolean(),
  options: FormFieldOptions = {},
): FormField<unknown, 'checkbox'> {
  return Object.freeze({ ...options, kind: 'field', formKind: 'checkbox', schema })
}

/**
 * Identifies a scalar form description rather than a repeated or file entry.
 * @param entry An entry from an inspectable form schema.
 * @returns Whether the entry has scalar form decoding metadata.
 */
export function isFormField(entry: FormDataEntrySchema<unknown>): entry is FormField {
  return (
    'formKind' in entry &&
    (entry.formKind === 'text' ||
      entry.formKind === 'password' ||
      entry.formKind === 'number' ||
      entry.formKind === 'checkbox')
  )
}

/**
 * Decodes and validates one scalar form value for server or native-control adapters.
 * @param entry The shared field description.
 * @param raw The raw string, checkbox state, or missing value.
 * @param path Logical field path for validation issues.
 * @param options Ordinary schema parsing options.
 * @returns The validated output or ordinary schema issues.
 */
export function validateField<output>(
  entry: FormField<output>,
  raw: unknown,
  path: NonNullable<Issue['path']> = [],
  options?: ParseOptions,
): ValidationResult<output> {
  let value = raw
  if (entry.formKind === 'checkbox') {
    value = typeof raw === 'boolean' ? raw : raw !== undefined
  } else if (typeof raw === 'string') {
    if (entry.formKind === 'number') {
      if (raw.trim() === '') value = undefined
      else {
        let result = numeric['~run'](raw, { path, options: messageOptions(entry, raw, options) })
        if (result.issues) return { issues: result.issues }
        value = result.value
      }
    } else if (raw === '' && entry.empty !== 'preserve') value = undefined
  }
  return entry.schema['~run'](value, { path, options: messageOptions(entry, value, options) })
}

function messageOptions(
  entry: FormField,
  value: unknown,
  options?: ParseOptions,
): ParseOptions | undefined {
  if (!entry.errorMap) return options
  return {
    ...options,
    errorMap(context) {
      let missing = value === undefined || (entry.formKind === 'checkbox' && value === false)
      return (
        entry.errorMap?.(missing ? { ...context, code: 'value.required' } : context) ??
        options?.errorMap?.(context)
      )
    },
  }
}

/**
 * Creates an inspectable form schema using ordinary schema validation and parsing.
 * @param entries Scalar form descriptions or existing repeated/file entries.
 * @returns A schema accepting FormData or URLSearchParams with immutable typed entries.
 */
export function object<const entries extends FormEntries>(entries: entries): FormSchema<entries> {
  let descriptions = Object.fromEntries(
    Object.entries(entries).map(([key, entry]) => [
      key,
      Object.isFrozen(entry) ? entry : Object.freeze({ ...entry }),
    ]),
  )
  let extracted = Object.fromEntries(
    Object.entries(descriptions).map(([key, entry]) => [
      key,
      isFormField(entry)
        ? {
            kind: 'field' as const,
            name: entry.name,
            schema: createSchema((value, context) =>
              validateField(entry, value, context.path, context.options),
            ),
          }
        : entry,
    ]),
  )
  // Each extracted entry delegates to the corresponding original schema, preserving its output.
  let schema = Object.defineProperties(formDataObject(extracted), {
    entries: { value: Object.freeze(descriptions), enumerable: true },
    parse: {
      value(value: unknown, options?: ParseOptions): FormValue<entries> {
        return parseValue(schema, value, options)
      },
    },
    parseSafe: {
      value(value: unknown, options?: ParseOptions): FormParseResult<FormValue<entries>> {
        return parseSafe(schema, value, options)
      },
    },
  }) as FormSchema<entries>
  return schema
}

/**
 * Parses a form once and adapts failures for safe value restoration and error rendering.
 * @param schema The same inspectable schema consumed by the UI context.
 * @param data The FormData or URLSearchParams input to validate.
 * @param options Ordinary schema parsing options.
 * @returns Validated output or safe raw values and grouped messages.
 */
export function parseSafe<entries extends FormEntries>(
  schema: FormSchema<entries>,
  data: unknown,
  options?: ParseOptions,
): FormParseResult<FormValue<entries>> {
  let result = parseValueSafe(schema, data, options)
  if (result.success) return result
  let values: Array<[string, FormRawValue]> = []
  if (data instanceof FormData || data instanceof URLSearchParams) {
    for (let [key, entry] of Object.entries(schema.entries)) {
      let name = entry.name ?? key
      if (isFormField(entry) && entry.formKind === 'password') continue
      if (isFormField(entry) && entry.formKind === 'checkbox') values.push([key, data.has(name)])
      else if (entry.kind === 'field') {
        let value = data.get(name)
        if (typeof value === 'string') values.push([key, value])
      } else if (entry.kind === 'fields') {
        let raw = data.getAll(name)
        if (raw.every((value) => typeof value === 'string')) values.push([key, raw])
      }
    }
  }
  let issues = result.issues.map(safeIssue)
  let grouped = new Map<string, string[]>()
  let form: string[] = []
  for (let issue of issues) {
    let key = issue.path?.[0]
    if (typeof key === 'string' && Object.hasOwn(schema.entries, key)) {
      let messages = grouped.get(key) ?? []
      messages.push(issue.message)
      grouped.set(key, messages)
    } else form.push(issue.message)
  }
  return {
    success: false,
    issues,
    values: Object.fromEntries(values),
    errors: { fields: Object.fromEntries(grouped), form },
  }
}

function safeIssue(issue: Issue): FormIssue {
  return {
    message: issue.message,
    ...(issue.path
      ? {
          path: issue.path.map((segment) => {
            let key = typeof segment === 'object' ? segment.key : segment
            return typeof key === 'number' ? key : String(key)
          }),
        }
      : {}),
  }
}
