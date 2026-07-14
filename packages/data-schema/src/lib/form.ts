import type { InferOutput, Issue, ObjectSchema, ObjectShape, Schema } from './schema.ts'
import { getSchemaChecks, schemaAcceptsUndefined } from './schema.ts'

/**
 * Native input types supported by a form field.
 */
export type FormInputType = 'email' | 'number' | 'password' | 'text' | 'url'

/**
 * UI-only configuration for a projected model field.
 */
export interface FormFieldOptions {
  /** The visible label text for the field. */
  label: string
  /** The native input type and corresponding `FormData` decoder. */
  type: FormInputType
  /** The submitted field name. (defaults to the model property name) */
  name?: string
}

/**
 * UI configuration and validation for a field that is not part of the model.
 */
export interface AncillaryFormFieldOptions<schema extends Schema<any, unknown>>
  extends FormFieldOptions {
  /** The authoritative schema for the ancillary value. */
  schema: schema
}

/**
 * Native attributes derived for a projected model field.
 */
export interface InputAttributes {
  /** The submitted field name. */
  name: string
  /** The native input type. */
  type: FormInputType
  /** Whether the input must contain a value. */
  required?: true
  /** The minimum text length accepted by the model. */
  minLength?: number
  /** The maximum text length accepted by the model. */
  maxLength?: number
  /** The minimum numeric value accepted by the model. */
  min?: number
  /** The maximum numeric value accepted by the model. */
  max?: number
  /** The interval accepted by a numeric input. */
  step?: number | 'any'
}

/**
 * The result of decoding and validating submitted form data.
 */
export type FormParseResult<value> =
  | { success: true; value: value }
  | {
      success: false
      issues: ReadonlyArray<Issue>
      values: Readonly<Record<string, string>>
      errors: FormErrors
    }

/**
 * Serializable validation errors grouped by field and form.
 */
export interface FormErrors {
  /** Validation messages keyed by logical form field name. */
  fields: Readonly<Record<string, ReadonlyArray<string>>>
  /** Validation messages that do not belong to one form field. */
  form: ReadonlyArray<string>
}

type AnyFormFieldOptions = FormFieldOptions | AncillaryFormFieldOptions<Schema<any, unknown>>

type FormFields = Record<string, AnyFormFieldOptions>

type ValidFormFields<shape extends ObjectShape, fields extends FormFields> = {
  [key in keyof fields]: key extends keyof shape
    ? fields[key] extends { schema: unknown }
      ? never
      : fields[key]
    : fields[key] extends AncillaryFormFieldOptions<Schema<any, unknown>>
      ? fields[key]
      : never
}

type FormFieldSchema<
  shape extends ObjectShape,
  fields extends FormFields,
  key extends keyof fields,
> = key extends keyof shape
  ? shape[key]
  : fields[key] extends AncillaryFormFieldOptions<infer schema>
    ? schema
    : never

type FormValue<shape extends ObjectShape, fields extends FormFields> = {
  -readonly [key in keyof fields]: InferOutput<FormFieldSchema<shape, fields, key>>
}

/**
 * A model-backed form projection with native input attributes and server parsing.
 */
export interface FormDefinition<shape extends ObjectShape, fields extends FormFields> {
  /** The UI-only field configuration in render order. */
  readonly fields: fields
  /**
   * Derives native attributes for one projected model field.
   *
   * @param field The projected model property name.
   * @returns Attributes that can be spread onto a native `input` element.
   */
  getInputAttrs<field extends keyof fields & string>(field: field): InputAttributes
  /**
   * Decodes submitted values according to their input types and validates them with the model.
   *
   * @param formData The submitted form payload.
   * @returns A typed value or the model validation issues.
   */
  parse(formData: FormData): FormParseResult<FormValue<shape, fields>>
}

/**
 * Creates a UI form projection from selected fields in an object schema.
 *
 * @param model The authoritative object schema.
 * @param options UI-only configuration for the fields included in this form.
 * @returns A form definition that derives native attributes and validates `FormData`.
 * @example
 * ```ts
 * import * as s from 'remix/data-schema'
 * import { createForm } from 'remix/data-schema/form'
 *
 * let User = s.object({ name: s.string(), age: s.number() })
 * let UserForm = createForm(User, {
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
export function createForm<shape extends ObjectShape, const fields extends FormFields>(
  model: ObjectSchema<shape>,
  options: { fields: fields & ValidFormFields<shape, fields> },
): FormDefinition<shape, fields> {
  let fields = options.fields

  return {
    fields,
    getInputAttrs(field) {
      let fieldOptions = fields[field]

      if (!fieldOptions) {
        throw new Error(`Unknown form field "${field}"`)
      }

      let schema = getFieldSchema(model, field, fieldOptions)
      let attrs: InputAttributes = {
        name: fieldOptions.name ?? field,
        type: fieldOptions.type,
      }

      if (fieldOptions.type === 'number') {
        attrs.step = 'any'
      }

      if (!schemaAcceptsUndefined(schema)) {
        attrs.required = true
      }

      for (let check of getSchemaChecks(schema)) {
        switch (check.code) {
          case 'string.min_length':
            attrs.minLength = getConstraintValue(check.values, 'min')
            break
          case 'string.max_length':
            attrs.maxLength = getConstraintValue(check.values, 'max')
            break
          case 'number.min':
            attrs.min = getConstraintValue(check.values, 'min')
            break
          case 'number.max':
            attrs.max = getConstraintValue(check.values, 'max')
            break
        }
      }

      return attrs
    },
    parse(formData) {
      let issues: Issue[] = []
      let value: Record<string, unknown> = {}
      let rawValues: Record<string, string> = {}

      for (let field of Object.keys(fields)) {
        let fieldOptions = fields[field]

        if (!fieldOptions) {
          continue
        }

        let schema = getFieldSchema(model, field, fieldOptions)
        let fieldName = fieldOptions.name ?? field
        let rawValue = formData.get(fieldName)

        if (typeof rawValue === 'string') {
          rawValues[field] = rawValue
        }

        let input = decodeFormValue(rawValue, fieldOptions.type)
        let result = schema['~run'](input, { path: [field] })

        if (result.issues) {
          issues.push(...result.issues)
        } else {
          value[field] = result.value
        }
      }

      if (issues.length > 0) {
        return {
          success: false,
          issues,
          values: rawValues,
          errors: groupFormErrors(issues, new Set(Object.keys(fields))),
        }
      }

      return { success: true, value: value as FormValue<shape, fields> }
    },
  }
}

function getFieldSchema<shape extends ObjectShape>(
  model: ObjectSchema<shape>,
  field: string,
  options: AnyFormFieldOptions,
): Schema<any, unknown> {
  let schema: Schema<any, unknown> | undefined = model.shape[field]

  if (schema) {
    if ('schema' in options) {
      throw new Error(`Model field "${field}" cannot override its schema`)
    }

    return schema
  }

  if ('schema' in options) {
    return options.schema
  }

  throw new Error(`Ancillary form field "${field}" requires a schema`)
}

function groupFormErrors(issues: ReadonlyArray<Issue>, fields: ReadonlySet<string>): FormErrors {
  let fieldErrors: Record<string, ReadonlyArray<string>> = {}
  let formErrors: string[] = []

  for (let issue of issues) {
    let field = getIssueField(issue, fields)

    if (field) {
      let messages = fieldErrors[field] ?? []
      fieldErrors[field] = [...messages, issue.message]
    } else {
      formErrors.push(issue.message)
    }
  }

  return { fields: fieldErrors, form: formErrors }
}

function getIssueField(issue: Issue, fields: ReadonlySet<string>): string | undefined {
  let segment = issue.path?.[0]
  let key: string | undefined

  if (typeof segment === 'string' || typeof segment === 'number' || typeof segment === 'symbol') {
    key = String(segment)
  } else if (segment && typeof segment === 'object' && 'key' in segment) {
    key = String(segment.key)
  }

  return key && fields.has(key) ? key : undefined
}

function getConstraintValue(
  values: Record<string, unknown> | undefined,
  key: string,
): number | undefined {
  let value = values?.[key]
  return typeof value === 'number' ? value : undefined
}

function decodeFormValue(value: FormDataEntryValue | null, type: FormInputType): unknown {
  if (typeof value !== 'string') {
    return undefined
  }

  if (type === 'number') {
    if (value.trim() === '') {
      return undefined
    }

    return Number(value)
  }

  if (value === '') {
    return undefined
  }

  return value
}
