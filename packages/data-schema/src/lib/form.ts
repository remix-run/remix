import type {
  GetConstraintsOptions,
  InferOutput,
  Issue,
  ObjectSchema,
  ObjectShape,
  Schema,
  SchemaConstraints,
} from './schema.ts'
import { getConstraints } from './schema.ts'

/**
 * Native input types supported by a form field.
 */
export type FormInputType = GetConstraintsOptions['type']

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
  /** The DOM id used to associate the input, label, and error. (defaults to the property name) */
  id?: string
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
export interface InputAttributes<type extends FormInputType = FormInputType> {
  /** The DOM id used by the field label and error message. */
  id: string
  /** The submitted field name. */
  name: string
  /** The native input type. */
  type: type
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
  /** The submitted text value from a failed validation result. */
  defaultValue?: string
  /** The submitted checkbox state from a failed validation result. */
  defaultChecked?: boolean
  /** Whether server or native validation has marked the input invalid. */
  'aria-invalid'?: 'true'
  /** The id of the field error describing the input. */
  'aria-describedby'?: string
  /** The server-rendered error element to clear after the input changes. */
  'data-form-error-id'?: string
}

/**
 * A raw form value that can be serialized and restored to a native input.
 */
export type FormRawValue = boolean | string

/**
 * A failed form validation result suitable for returning to a rendered route.
 */
export interface FormFailure extends FormSubmission {
  /** Discriminates failed results from successful results. */
  success: false
  /** The original validation issues. */
  issues: ReadonlyArray<Issue>
}

/**
 * Serializable form state used to restore values and errors in rendered UI.
 */
export type FormSubmission = {
  /** Submitted values keyed by logical form field name. Password values are omitted. */
  values: Readonly<Record<string, FormRawValue>>
  /** Validation messages grouped for rendering. */
  errors: FormErrors
}

/**
 * A successfully decoded and validated form value.
 */
export interface FormSuccess<value> {
  /** Discriminates successful results from failed results. */
  success: true
  /** The typed form value. */
  value: value
}

/**
 * The result of decoding and validating submitted form data.
 */
export type FormParseResult<value> = FormSuccess<value> | FormFailure

/**
 * Serializable validation errors grouped by field and form.
 */
export type FormErrors = {
  /** Validation messages keyed by logical form field name. */
  fields: Readonly<Record<string, ReadonlyArray<string>>>
  /** Validation messages that do not belong to one form field. */
  form: ReadonlyArray<string>
}

/**
 * Native attributes that associate a label with its input.
 */
export interface LabelAttributes {
  /** The id of the labeled input. */
  htmlFor: string
}

/**
 * Native attributes that identify a field error.
 */
export interface ErrorAttributes {
  /** The id referenced by an invalid input's `aria-describedby`. */
  id: string
}

type AnyFormFieldOptions = FormFieldOptions | AncillaryFormFieldOptions<Schema<any, unknown>>

type FormFields = Record<string, AnyFormFieldOptions>

type ResolvedFormFields<fields extends FormFields> = {
  readonly [field in keyof fields]: Omit<fields[field], 'required'> & {
    readonly required: boolean
  }
}

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
  /** The field configuration in render order, including schema-derived requiredness. */
  readonly fields: ResolvedFormFields<fields>
  /**
   * Derives native attributes for one projected model field.
   *
   * @param field The projected model property name.
   * @param submission A failed form result whose values and errors should be restored.
   * @returns Attributes that can be spread onto a native `input` element.
   */
  getInputAttrs<field extends keyof fields & string>(
    field: field,
    submission?: FormSubmission,
  ): InputAttributes<fields[field]['type']>
  /**
   * Associates a native label with one projected field.
   *
   * @param field The projected field name.
   * @returns Attributes that can be spread onto a native `label` element.
   */
  getLabelAttrs<field extends keyof fields & string>(field: field): LabelAttributes
  /**
   * Identifies the error element for one projected field.
   *
   * @param field The projected field name.
   * @returns Attributes that can be spread onto the field's error element.
   */
  getErrorAttrs<field extends keyof fields & string>(field: field): ErrorAttributes
  /**
   * Reads the server validation messages for one projected field.
   *
   * @param field The projected field name.
   * @param submission A failed form result.
   * @returns The field's validation messages, or an empty array.
   */
  getFieldErrors<field extends keyof fields & string>(
    field: field,
    submission?: FormSubmission,
  ): ReadonlyArray<string>
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
  let configuredFields = options.fields
  let fieldConstraints = new Map<string, SchemaConstraints>()
  let resolvedFieldEntries: Array<[string, AnyFormFieldOptions & { readonly required: boolean }]> =
    []

  for (let field of Object.keys(configuredFields)) {
    let fieldOptions = getFieldOptions(configuredFields, field)
    let schema = getFieldSchema(model, field, fieldOptions)
    let constraints = getConstraints(schema, { type: fieldOptions.type })

    fieldConstraints.set(field, constraints)
    resolvedFieldEntries.push([field, { ...fieldOptions, required: constraints.required === true }])
  }

  let fields = Object.fromEntries(resolvedFieldEntries) as ResolvedFormFields<fields>

  return {
    fields,
    getInputAttrs(field, submission) {
      let fieldOptions = getFieldOptions(fields, field)
      let id = fieldOptions.id ?? field
      let attrs: InputAttributes<typeof fieldOptions.type> = {
        id,
        name: fieldOptions.name ?? field,
        type: fieldOptions.type,
      }

      Object.assign(attrs, getFieldConstraints(fieldConstraints, field))

      let rawValue = submission?.values[field]

      if (typeof rawValue === 'string') {
        attrs.defaultValue = rawValue
      } else if (typeof rawValue === 'boolean') {
        attrs.defaultChecked = rawValue
      }

      if (readFieldErrors(field, submission).length > 0) {
        let errorId = getErrorId(id)
        attrs['aria-invalid'] = 'true'
        attrs['aria-describedby'] = errorId
        attrs['data-form-error-id'] = errorId
      }

      return attrs
    },
    getLabelAttrs(field) {
      return { htmlFor: getFieldId(fields, field) }
    },
    getErrorAttrs(field) {
      return { id: getErrorId(getFieldId(fields, field)) }
    },
    getFieldErrors(field, submission) {
      return readFieldErrors(field, submission)
    },
    parse(formData) {
      let issues: Issue[] = []
      let valueEntries: Array<[string, unknown]> = []
      let rawValueEntries: Array<[string, FormRawValue]> = []

      for (let field of Object.keys(fields)) {
        let fieldOptions = getFieldOptions(fields, field)
        let schema = getFieldSchema(model, field, fieldOptions)
        let fieldName = fieldOptions.name ?? field
        let rawValue = readRawFormValue(formData, fieldName, fieldOptions.type)

        if (rawValue !== undefined && fieldOptions.type !== 'password') {
          rawValueEntries.push([field, rawValue])
        }

        let input = decodeFormValue(rawValue, fieldOptions.type)
        let result = schema['~run'](input, { path: [field] })

        if (result.issues) {
          issues.push(...result.issues)
        } else {
          valueEntries.push([field, result.value])
        }
      }

      if (issues.length > 0) {
        return {
          success: false,
          issues,
          values: Object.fromEntries(rawValueEntries),
          errors: groupFormErrors(issues, new Set(Object.keys(fields))),
        }
      }

      return {
        success: true,
        value: Object.fromEntries(valueEntries) as FormValue<shape, fields>,
      }
    },
  }
}

function getFieldConstraints(
  constraints: ReadonlyMap<string, SchemaConstraints>,
  field: string,
): SchemaConstraints {
  let fieldConstraints = constraints.get(field)

  if (!fieldConstraints) {
    throw new Error(`Unknown form field "${field}"`)
  }

  return fieldConstraints
}

function getFieldOptions<fields extends FormFields, field extends keyof fields & string>(
  fields: fields,
  field: field,
): fields[field] {
  if (!Object.prototype.hasOwnProperty.call(fields, field)) {
    throw new Error(`Unknown form field "${field}"`)
  }

  return fields[field]
}

function getFieldId<fields extends FormFields>(
  fields: fields,
  field: keyof fields & string,
): string {
  let options = getFieldOptions(fields, field)
  return options.id ?? field
}

function getErrorId(fieldId: string): string {
  return `${fieldId}-error`
}

function readFieldErrors(field: string, submission?: FormSubmission): ReadonlyArray<string> {
  return submission?.errors.fields[field] ?? []
}

function getFieldSchema<shape extends ObjectShape>(
  model: ObjectSchema<shape>,
  field: string,
  options: AnyFormFieldOptions,
): Schema<any, unknown> {
  let schema: Schema<any, unknown> | undefined = Object.prototype.hasOwnProperty.call(
    model.shape,
    field,
  )
    ? model.shape[field]
    : undefined

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
  let fieldErrors = new Map<string, ReadonlyArray<string>>()
  let formErrors: string[] = []

  for (let issue of issues) {
    let field = getIssueField(issue, fields)

    if (field) {
      let messages = fieldErrors.get(field) ?? []
      fieldErrors.set(field, [...messages, issue.message])
    } else {
      formErrors.push(issue.message)
    }
  }

  return { fields: Object.fromEntries(fieldErrors), form: formErrors }
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

function readRawFormValue(
  formData: FormData,
  name: string,
  type: FormInputType,
): FormRawValue | undefined {
  if (type === 'checkbox') {
    return formData.has(name)
  }

  let value = formData.get(name)
  return typeof value === 'string' ? value : undefined
}

function decodeFormValue(value: FormRawValue | undefined, type: FormInputType): unknown {
  if (type === 'checkbox') {
    return value ?? false
  }

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
