import type { InferOutput, Issue, Schema } from '@remix-run/data-schema'
import { createIssue, parseSafe, ValidationError } from '@remix-run/data-schema'

type FormDataExtractorKind = 'field' | 'fields' | 'file' | 'files'

type FormDataExtractionResult<output> =
  | { value: output }
  | { issues: ReadonlyArray<Issue> }

/**
 * A form-data extraction helper that reads one or more values for a field and validates them.
 */
export interface FormDataExtractor<output> {
  /** The extraction mode used to read values from the `FormData` object. */
  kind: FormDataExtractorKind
  /** The form field name to read. Defaults to the object key passed to `extractFormData()`. */
  name?: string
  /** The schema used to validate the extracted value or values. */
  schema: Schema<any, output>
}

/**
 * Options for extracting a single text field from `FormData`.
 */
export interface FormDataFieldOptions {
  /** The form field name to read. Defaults to the object key passed to `extractFormData()`. */
  name?: string
}

/**
 * Options for extracting repeated text fields from `FormData`.
 */
export interface FormDataFieldsOptions {
  /** The form field name to read. Defaults to the object key passed to `extractFormData()`. */
  name?: string
}

/**
 * Options for extracting a single file field from `FormData`.
 */
export interface FormDataFileOptions {
  /** The form field name to read. Defaults to the object key passed to `extractFormData()`. */
  name?: string
}

/**
 * Options for extracting repeated file fields from `FormData`.
 */
export interface FormDataFilesOptions {
  /** The form field name to read. Defaults to the object key passed to `extractFormData()`. */
  name?: string
}

/**
 * A schema-like object that describes the fields to extract from `FormData`.
 */
export type FormDataExtractionSchema = Record<string, FormDataExtractor<any>>

/**
 * The typed result produced by `extractFormData()` for a given extraction schema.
 */
export type ExtractedFormData<schema extends FormDataExtractionSchema> = {
  [key in keyof schema]: schema[key] extends FormDataExtractor<infer output> ? output : never
}

/**
 * Creates an extractor for a single text field from `FormData`.
 *
 * @param schema The schema used to validate the extracted field value.
 * @param options Extraction options for the field.
 * @returns A field extractor for use with `extractFormData()`.
 */
export function field<schema extends Schema<any, any>>(
  schema: schema,
  options?: FormDataFieldOptions,
): FormDataExtractor<InferOutput<schema>> {
  return {
    kind: 'field',
    name: options?.name,
    schema,
  }
}

/**
 * Creates an extractor for repeated text fields from `FormData`.
 *
 * @param schema The schema used to validate the extracted field values.
 * @param options Extraction options for the field.
 * @returns A field extractor for use with `extractFormData()`.
 */
export function fields<schema extends Schema<any, any>>(
  schema: schema,
  options?: FormDataFieldsOptions,
): FormDataExtractor<InferOutput<schema>> {
  return {
    kind: 'fields',
    name: options?.name,
    schema,
  }
}

/**
 * Creates an extractor for a single file field from `FormData`.
 *
 * @param schema The schema used to validate the extracted file value.
 * @param options Extraction options for the field.
 * @returns A file extractor for use with `extractFormData()`.
 */
export function file<schema extends Schema<any, any>>(
  schema: schema,
  options?: FormDataFileOptions,
): FormDataExtractor<InferOutput<schema>> {
  return {
    kind: 'file',
    name: options?.name,
    schema,
  }
}

/**
 * Creates an extractor for repeated file fields from `FormData`.
 *
 * @param schema The schema used to validate the extracted file values.
 * @param options Extraction options for the field.
 * @returns A file extractor for use with `extractFormData()`.
 */
export function files<schema extends Schema<any, any>>(
  schema: schema,
  options?: FormDataFilesOptions,
): FormDataExtractor<InferOutput<schema>> {
  return {
    kind: 'files',
    name: options?.name,
    schema,
  }
}

/**
 * Extracts typed values from a `FormData` object using a field-extraction schema.
 *
 * @param formData The `FormData` object to read from.
 * @param schema The extraction schema describing the fields to read and validate.
 * @returns The validated output object.
 * @throws {ValidationError} When any extracted value fails validation.
 */
export function extractFormData<schema extends FormDataExtractionSchema>(
  formData: FormData,
  schema: schema,
): ExtractedFormData<schema> {
  let result = extractFormDataSafe(formData, schema)

  if (!result.success) {
    throw new ValidationError(result.issues)
  }

  return result.value
}

/**
 * Extracts typed values from a `FormData` object without throwing on validation failure.
 *
 * @param formData The `FormData` object to read from.
 * @param schema The extraction schema describing the fields to read and validate.
 * @returns A success result with the extracted value, or a failure result with issues.
 */
export function extractFormDataSafe<schema extends FormDataExtractionSchema>(
  formData: FormData,
  schema: schema,
):
  | { success: true; value: ExtractedFormData<schema> }
  | { success: false; issues: ReadonlyArray<Issue> } {
  let value: Partial<Record<keyof schema, unknown>> = {}
  let issues: Issue[] = []

  for (let [key, extractor] of Object.entries(schema) as [keyof schema & string, FormDataExtractor<any>][]) {
    let result = extractValue(formData, key, extractor)

    if ('issues' in result) {
      issues.push(...result.issues)
      continue
    }

    value[key] = result.value
  }

  if (issues.length > 0) {
    return { success: false, issues }
  }

  return { success: true, value: value as ExtractedFormData<schema> }
}

function extractValue(
  formData: FormData,
  key: string,
  extractor: FormDataExtractor<any>,
): FormDataExtractionResult<unknown> {
  let fieldName = extractor.name ?? key

  switch (extractor.kind) {
    case 'field': {
      let entry = formData.get(fieldName)

      if (entry instanceof Blob) {
        return {
          issues: [createIssue(`Expected text field "${fieldName}"`, [key])],
        }
      }

      return validateExtractedValue(key, extractor.schema, entry ?? undefined)
    }
    case 'fields': {
      let entries = formData.getAll(fieldName)
      let values: string[] = []
      let issues: Issue[] = []

      entries.forEach((entry, index) => {
        if (entry instanceof Blob) {
          issues.push(createIssue(`Expected text field "${fieldName}"`, [key, index]))
        } else {
          values.push(entry)
        }
      })

      if (issues.length > 0) {
        return { issues }
      }

      return validateExtractedValue(key, extractor.schema, values)
    }
    case 'file': {
      let entry = formData.get(fieldName)

      if (entry != null && !(entry instanceof Blob)) {
        return {
          issues: [createIssue(`Expected file field "${fieldName}"`, [key])],
        }
      }

      return validateExtractedValue(key, extractor.schema, entry ?? undefined)
    }
    case 'files': {
      let entries = formData.getAll(fieldName)
      let values: Blob[] = []
      let issues: Issue[] = []

      entries.forEach((entry, index) => {
        if (!(entry instanceof Blob)) {
          issues.push(createIssue(`Expected file field "${fieldName}"`, [key, index]))
        } else {
          values.push(entry)
        }
      })

      if (issues.length > 0) {
        return { issues }
      }

      return validateExtractedValue(key, extractor.schema, values)
    }
  }
}

function validateExtractedValue(
  key: string,
  schema: Schema<any, any>,
  value: unknown,
): FormDataExtractionResult<unknown> {
  let result = parseSafe(schema, value)

  if (!result.success) {
    return {
      issues: result.issues.map(issue => ({
        ...issue,
        path: [key, ...(issue.path ?? [])],
      })),
    }
  }

  return {
    value: result.value,
  }
}
