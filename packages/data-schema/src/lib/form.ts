import type {
  ErrorMap,
  GetConstraintsOptions,
  InferOutput,
  Issue,
  ObjectSchema,
  ObjectShape,
  Schema,
} from './schema.ts'
import { getConstraints } from './schema.ts'

/**
 * Native input types supported by a form field.
 */
export type FormInputType = GetConstraintsOptions['type']

/**
 * UI configuration and message customization for a projected model field.
 */
export interface FormFieldOptions {
  /** The visible label text for the field. */
  label: string
  /** The native input type and corresponding `FormData` decoder. */
  type: FormInputType
  /** The submitted field name. (defaults to the logical field name) */
  name?: string
  /** The DOM id used by the control, label, and error. (defaults to the logical field name) */
  id?: string
  /**
   * Customizes schema and native constraint messages on the server and client.
   * Return `undefined` to keep the default. Required empty values use `value.required`;
   * other failures use schema/domain codes. Supplemental `setCustomErrors` are not mapped.
   */
  errorMap?: ErrorMap
}

/**
 * UI configuration and validation for a reusable field.
 */
export interface FieldOptions<schema extends Schema<unknown, unknown>> extends FormFieldOptions {
  /** The authoritative schema for the field value. */
  schema: schema
}

/** UI configuration and validation for a field absent from the backing model. */
export interface AncillaryFormFieldOptions<
  schema extends Schema<any, unknown>,
> extends FieldOptions<schema> {}

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

/**
 * The native input state used for client-side schema validation.
 */
export interface InputValidationTarget {
  /** The input's current string value. */
  readonly value: string
  /** Whether a checkbox input is currently checked; absent for selects and textareas. */
  readonly checked?: boolean
  /** Sets or clears the input's custom Constraint Validation API message. */
  setCustomValidity(message: string): void
}

type AnyFormFieldOptions = FormFieldOptions | AncillaryFormFieldOptions<Schema<any, unknown>>

type FormFields = Record<string, AnyFormFieldOptions>

type ResolvedFormFields<shape extends ObjectShape, fields extends FormFields> = {
  readonly [field in keyof fields]: Omit<fields[field], 'required'> &
    FieldDefinition<FormFieldSchema<shape, fields, field>, fields[field]['type']>
}

// Infer names independently so inline errorMap callbacks retain contextual types.
type ValidFormFields<shape extends ObjectShape, field extends string> = {
  [key in field]: key extends keyof shape
    ? FormFieldOptions & { schema?: never }
    : AncillaryFormFieldOptions<Schema<any, unknown>>
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
 * Configured schema-backed fields with native attributes and server parsing.
 */
export interface FormDefinition<shape extends ObjectShape, fields extends FormFields> {
  /** The field configuration in render order, including schema-derived requiredness. */
  readonly fields: ResolvedFormFields<shape, fields>
  /**
   * Derives native attributes for one configured field.
   *
   * @param field The logical field name.
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
   * Creates a synchronous client-side validator for one projected field.
   *
   * The validator decodes the current input state like the form's `parse()` and sets the first schema
   * issue as the input's custom Constraint Validation API message. A valid value clears any prior
   * custom message. Messages use the field's `errorMap` when configured.
   *
   * @param field The projected field name.
   * @returns A validator that accepts a native input or compatible input state.
   */
  createInputValidator<field extends keyof fields & string>(
    field: field,
  ): (input: InputValidationTarget) => void
  /**
   * Decodes and validates configured fields, without running backing object-level rules.
   *
   * @param formData The submitted form payload.
   * @returns Typed field values or a serializable failure with values and grouped errors.
   */
  parse(formData: FormData): FormParseResult<FormValue<shape, fields>>
}

/** A reusable schema-backed field, independent of any form or browser state. */
export interface FieldDefinition<
  schema extends Schema<unknown, unknown>,
  type extends FormInputType,
> extends FieldOptions<schema> {
  /** The native input type and form-value decoder. */
  readonly type: type
  /** Whether the field requires a value. */
  readonly required: boolean
  /**
   * Derives native control attributes and restores submitted values and errors.
   * @param name Logical field name, used when no explicit name or id is configured.
   * @param submission Failed submission to restore.
   * @returns Native control attributes.
   */
  getInputAttrs(name: string, submission?: FormSubmission): InputAttributes<type>
  /**
   * Associates a label with this field.
   * @param name Logical field name.
   * @returns Label attributes.
   */
  getLabelAttrs(name: string): LabelAttributes
  /**
   * Identifies the application's error element.
   * @param name Logical field name.
   * @returns Error attributes.
   */
  getErrorAttrs(name: string): ErrorAttributes
  /**
   * Reads server validation messages.
   * @param name Logical field name.
   * @param submission Failed submission to read.
   * @returns Visible server messages.
   */
  getFieldErrors(name: string, submission?: FormSubmission): ReadonlyArray<string>
  /**
   * Creates a synchronous schema validator using the field's `errorMap` and native custom validity.
   * @param name Logical field name used in validation issue paths (optional).
   * @returns A validator for an input, select, or textarea.
   */
  createInputValidator(name?: string): (control: InputValidationTarget) => void
  /**
   * Decodes and validates this field from a form payload.
   * @param formData Submitted payload.
   * @param name Logical field name used for values and error paths.
   * @returns A typed value or a serializable failed submission.
   */
  parse(formData: FormData, name: string): FormParseResult<InferOutput<schema>>
}

/**
 * Creates a reusable field definition with native constraints and server parsing.
 * @param options The field's schema and UI metadata; names default when the field is bound.
 * @returns A stateless field definition that can be used independently or composed into a form.
 */
export function createField<
  schema extends Schema<unknown, unknown>,
  const type extends FormInputType,
>(options: FieldOptions<schema> & { type: type }): FieldDefinition<schema, type> {
  let constraints = getConstraints(options.schema, { type: options.type })

  function validate(rawValue: FormRawValue | undefined, name?: string) {
    let value = decodeFormValue(rawValue, options.type)
    let errorMap = options.errorMap
    return options.schema['~run'](value, {
      path: name === undefined ? [] : [name],
      options: errorMap
        ? {
            errorMap(context) {
              let missing = constraints.required && (value === undefined || value === false)
              return errorMap(missing ? { ...context, code: 'value.required' } : context)
            },
          }
        : undefined,
    })
  }

  return {
    ...options,
    required: constraints.required === true,
    getInputAttrs(name, submission) {
      let id = options.id ?? name
      let attrs: InputAttributes<type> = {
        id,
        name: options.name ?? name,
        type: options.type,
        ...constraints,
      }
      let rawValue = submission?.values[name]
      if (typeof rawValue === 'string') attrs.defaultValue = rawValue
      else if (typeof rawValue === 'boolean') attrs.defaultChecked = rawValue
      if (readFieldErrors(name, submission).length > 0) {
        let errorId = getErrorId(id)
        attrs['aria-invalid'] = 'true'
        attrs['aria-describedby'] = errorId
        attrs['data-form-error-id'] = errorId
      }
      return attrs
    },
    getLabelAttrs(name) {
      return { htmlFor: options.id ?? name }
    },
    getErrorAttrs(name) {
      return { id: getErrorId(options.id ?? name) }
    },
    getFieldErrors(name, submission) {
      return readFieldErrors(name, submission)
    },
    createInputValidator(name) {
      return (control) => {
        let rawValue = options.type === 'checkbox' ? control.checked : control.value
        let result = validate(rawValue, name)
        control.setCustomValidity(result.issues?.[0]?.message ?? '')
      }
    },
    parse(formData, name) {
      let rawValue = readRawFormValue(formData, options.name ?? name, options.type)
      let result = validate(rawValue, name)
      if (result.issues) {
        return {
          success: false,
          issues: result.issues,
          values: rawValue !== undefined && options.type !== 'password' ? { [name]: rawValue } : {},
          errors: groupFormErrors(result.issues, new Set([name])),
        }
      }
      // The schema's validator produces its inferred output after successful validation.
      return { success: true, value: result.value as InferOutput<schema> }
    },
  }
}

/**
 * Creates a UI form from an optional object schema and configured fields.
 *
 * Fields inherit their schemas from `options.schema`. Fields absent from that schema must provide
 * an inline schema; when `options.schema` is omitted, every field must provide one.
 *
 * @param options The optional backing schema and UI configuration for the included fields.
 * @returns A form definition that derives native attributes and validates `FormData`.
 * @example
 * ```ts
 * import * as s from 'remix/data-schema'
 * import { createForm } from 'remix/data-schema/form'
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
export function createForm<
  field extends string,
  const fields extends FormFields & Record<field, AnyFormFieldOptions>,
  shape extends ObjectShape = Record<never, never>,
>(options: {
  schema?: ObjectSchema<shape>
  fields: fields & ValidFormFields<NoInfer<shape>, field>
}): FormDefinition<shape, fields> {
  let model = options.schema
  let configuredFields = options.fields
  let resolvedFieldEntries: Array<
    [string, FieldDefinition<Schema<unknown, unknown>, FormInputType>]
  > = []

  for (let field of Object.keys(configuredFields)) {
    let fieldOptions = getFieldOptions(configuredFields, field)
    let schema = getFieldSchema(model, field, fieldOptions)
    resolvedFieldEntries.push([field, createField({ ...fieldOptions, schema })])
  }

  // Every configured field is resolved with its authoritative schema above.
  let fields = Object.fromEntries(resolvedFieldEntries) as ResolvedFormFields<shape, fields>

  return {
    fields,
    getInputAttrs(field, submission) {
      return getFieldOptions(fields, field).getInputAttrs(field, submission)
    },
    getLabelAttrs(field) {
      return getFieldOptions(fields, field).getLabelAttrs(field)
    },
    getErrorAttrs(field) {
      return getFieldOptions(fields, field).getErrorAttrs(field)
    },
    getFieldErrors(field, submission) {
      return getFieldOptions(fields, field).getFieldErrors(field, submission)
    },
    createInputValidator(field) {
      return getFieldOptions(fields, field).createInputValidator(field)
    },
    parse(formData) {
      let issues: Issue[] = []
      let valueEntries: Array<[string, unknown]> = []
      let rawValueEntries: Array<[string, FormRawValue]> = []

      for (let field of Object.keys(fields)) {
        let fieldOptions = getFieldOptions(fields, field)
        let fieldName = fieldOptions.name ?? field
        let rawValue = readRawFormValue(formData, fieldName, fieldOptions.type)

        if (rawValue !== undefined && fieldOptions.type !== 'password') {
          rawValueEntries.push([field, rawValue])
        }

        let result = fieldOptions.parse(formData, field)
        if (!result.success) {
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

function getFieldOptions<fields extends FormFields, field extends keyof fields & string>(
  fields: fields,
  field: field,
): fields[field] {
  if (!Object.prototype.hasOwnProperty.call(fields, field)) {
    throw new Error(`Unknown form field "${field}"`)
  }

  return fields[field]
}

function getErrorId(fieldId: string): string {
  return `${fieldId}-error`
}

function readFieldErrors(field: string, submission?: FormSubmission): ReadonlyArray<string> {
  return submission?.errors.fields[field] ?? []
}

function getFieldSchema<shape extends ObjectShape>(
  model: ObjectSchema<shape> | undefined,
  field: string,
  options: AnyFormFieldOptions,
): Schema<any, unknown> {
  let schema =
    model && Object.prototype.hasOwnProperty.call(model.shape, field)
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
