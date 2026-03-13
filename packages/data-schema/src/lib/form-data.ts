import type { InferOutput, Issue, ParseOptions, Schema } from './schema.ts'
import { createIssue, createSchema, fail } from './schema.ts'

type FormDataEntryKind = 'field' | 'fields' | 'file' | 'files'

/**
 * A Standard Schema-compatible input type for form-like data containers.
 */
export type FormDataSource = FormData | URLSearchParams

type FormDataParseResult<output> = { value: output } | { issues: ReadonlyArray<Issue> }

type FormDataValidationContext = {
  path: NonNullable<Issue['path']>
  options?: ParseOptions
}

/**
 * A schema entry that reads one or more values from `FormData` or `URLSearchParams` and validates
 * them.
 */
export interface FormDataEntrySchema<output> {
  /** The parsing mode used to read values from the input object. */
  kind: FormDataEntryKind
  /** The form field name to read. Defaults to the object key passed to `object()`. */
  name?: string
  /** The schema used to validate the parsed value or values. */
  schema: Schema<any, output>
}

/**
 * Options for parsing a single text field from `FormData` or `URLSearchParams`.
 */
export interface FormDataFieldOptions {
  /** The form field name to read. Defaults to the object key passed to `object()`. */
  name?: string
}

/**
 * Options for parsing repeated text fields from `FormData` or `URLSearchParams`.
 */
export interface FormDataFieldsOptions {
  /** The form field name to read. Defaults to the object key passed to `object()`. */
  name?: string
}

/**
 * Options for parsing a single file field from `FormData`.
 */
export interface FormDataFileOptions {
  /** The form field name to read. Defaults to the object key passed to `object()`. */
  name?: string
}

/**
 * Options for parsing repeated file fields from `FormData`.
 */
export interface FormDataFilesOptions {
  /** The form field name to read. Defaults to the object key passed to `object()`. */
  name?: string
}

/**
 * A schema-like object that describes the fields to parse from `FormData` or `URLSearchParams`.
 */
export type FormDataSchema = Record<string, FormDataEntrySchema<any>>

/**
 * A Standard Schema-compatible schema that validates a `FormData` or `URLSearchParams` object.
 */
export type FormDataObjectSchema<schema extends FormDataSchema> = Schema<
  FormDataSource,
  ParsedFormData<schema>
>

/**
 * The typed result produced by `object()` for a given form-data shape.
 */
export type ParsedFormData<schema extends FormDataSchema> = {
  [key in keyof schema]: schema[key] extends FormDataEntrySchema<infer output> ? output : never
}

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
export function object<schema extends FormDataSchema>(
  schema: schema,
): FormDataObjectSchema<schema> {
  return createSchema(function validate(value, context) {
    if (!isFormDataSource(value)) {
      return fail('Expected FormData or URLSearchParams', context.path, {
        code: 'type.form_data_source',
        input: value,
        parseOptions: context.options,
      })
    }

    let abortEarly = shouldAbortEarly(context.options)
    let issues: Issue[] = []
    let output: Partial<Record<keyof schema, unknown>> = {}

    for (let [key, entrySchema] of Object.entries(schema) as [
      keyof schema & string,
      FormDataEntrySchema<any>,
    ][]) {
      let result = parseField(value, key, entrySchema, context)

      if ('issues' in result) {
        if (abortEarly) {
          return { issues: result.issues }
        }

        issues.push(...result.issues)
        continue
      }

      output[key] = result.value
    }

    if (issues.length > 0) {
      return { issues }
    }

    return { value: output as ParsedFormData<schema> }
  })
}

/**
 * Creates a schema entry for a single text field from `FormData` or `URLSearchParams`.
 *
 * @param schema The schema used to validate the parsed field value.
 * @param options Parsing options for the field.
 * @returns A field schema entry for use with `object()`.
 */
export function field<schema extends Schema<any, any>>(
  schema: schema,
  options?: FormDataFieldOptions,
): FormDataEntrySchema<InferOutput<schema>> {
  return {
    kind: 'field',
    name: options?.name,
    schema,
  }
}

/**
 * Creates a schema entry for repeated text fields from `FormData` or `URLSearchParams`.
 *
 * @param schema The schema used to validate the parsed field values.
 * @param options Parsing options for the field.
 * @returns A field schema entry for use with `object()`.
 */
export function fields<schema extends Schema<any, any>>(
  schema: schema,
  options?: FormDataFieldsOptions,
): FormDataEntrySchema<InferOutput<schema>> {
  return {
    kind: 'fields',
    name: options?.name,
    schema,
  }
}

/**
 * Creates a schema entry for a single file field from `FormData`.
 *
 * @param schema The schema used to validate the parsed file value.
 * @param options Parsing options for the field.
 * @returns A file schema entry for use with `object()`.
 */
export function file<schema extends Schema<any, any>>(
  schema: schema,
  options?: FormDataFileOptions,
): FormDataEntrySchema<InferOutput<schema>> {
  return {
    kind: 'file',
    name: options?.name,
    schema,
  }
}

/**
 * Creates a schema entry for repeated file fields from `FormData`.
 *
 * @param schema The schema used to validate the parsed file values.
 * @param options Parsing options for the field.
 * @returns A file schema entry for use with `object()`.
 */
export function files<schema extends Schema<any, any>>(
  schema: schema,
  options?: FormDataFilesOptions,
): FormDataEntrySchema<InferOutput<schema>> {
  return {
    kind: 'files',
    name: options?.name,
    schema,
  }
}

function parseField(
  formData: FormDataSource,
  key: string,
  entrySchema: FormDataEntrySchema<any>,
  context: FormDataValidationContext,
): FormDataParseResult<unknown> {
  let fieldName = entrySchema.name ?? key
  let keyPath = withPath(context.path, key)

  switch (entrySchema.kind) {
    case 'field': {
      let value = formData.get(fieldName)

      if (value instanceof Blob) {
        return {
          issues: [createIssue(`Expected text field "${fieldName}"`, keyPath)],
        }
      }

      return validateParsedValue(keyPath, entrySchema.schema, value ?? undefined, context.options)
    }
    case 'fields': {
      let values = formData.getAll(fieldName)
      let parsedValues: string[] = []
      let issues: Issue[] = []

      values.forEach((value, index) => {
        if (value instanceof Blob) {
          issues.push(createIssue(`Expected text field "${fieldName}"`, withPath(keyPath, index)))
        } else {
          parsedValues.push(value)
        }
      })

      if (issues.length > 0) {
        return { issues }
      }

      return validateParsedValue(keyPath, entrySchema.schema, parsedValues, context.options)
    }
    case 'file': {
      let value = formData.get(fieldName)

      if (value != null && !(value instanceof Blob)) {
        return {
          issues: [createIssue(`Expected file field "${fieldName}"`, keyPath)],
        }
      }

      return validateParsedValue(keyPath, entrySchema.schema, value ?? undefined, context.options)
    }
    case 'files': {
      let values = formData.getAll(fieldName)
      let parsedValues: Blob[] = []
      let issues: Issue[] = []

      values.forEach((value, index) => {
        if (!(value instanceof Blob)) {
          issues.push(createIssue(`Expected file field "${fieldName}"`, withPath(keyPath, index)))
        } else {
          parsedValues.push(value)
        }
      })

      if (issues.length > 0) {
        return { issues }
      }

      return validateParsedValue(keyPath, entrySchema.schema, parsedValues, context.options)
    }
  }
}

function validateParsedValue(
  path: NonNullable<Issue['path']>,
  schema: Schema<any, any>,
  value: unknown,
  options?: ParseOptions,
): FormDataParseResult<unknown> {
  let result = schema['~run'](value, { path, options })

  if (result.issues) {
    return { issues: result.issues }
  }

  return {
    value: result.value,
  }
}

function shouldAbortEarly(options?: ParseOptions): boolean {
  let libraryAbortEarly = (options?.libraryOptions as { abortEarly?: unknown } | undefined)
    ?.abortEarly

  return Boolean(options?.abortEarly ?? libraryAbortEarly)
}

function withPath(path: NonNullable<Issue['path']>, key: PropertyKey): NonNullable<Issue['path']> {
  return path.length === 0 ? [key] : [...path, key]
}

function isFormDataSource(value: unknown): value is FormDataSource {
  return value instanceof FormData || value instanceof URLSearchParams
}
