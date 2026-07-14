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
  | { success: false; issues: ReadonlyArray<Issue> }

type FormFields<shape extends ObjectShape> = Partial<{
  [key in keyof shape & string]: FormFieldOptions
}>

type FormValue<shape extends ObjectShape, fields extends FormFields<shape>> = {
  [key in keyof fields & keyof shape]: InferOutput<shape[key]>
}

/**
 * A model-backed form projection with native input attributes and server parsing.
 */
export interface FormDefinition<shape extends ObjectShape, fields extends FormFields<shape>> {
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
 *   },
 * })
 * ```
 */
export function createForm<shape extends ObjectShape, const fields extends FormFields<shape>>(
  model: ObjectSchema<shape>,
  options: { fields: fields },
): FormDefinition<shape, fields> {
  let fields = options.fields

  return {
    fields,
    getInputAttrs(field) {
      let fieldOptions = fields[field]

      if (!fieldOptions) {
        throw new Error(`Unknown form field "${field}"`)
      }

      let schema = getFieldSchema(model, field)
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

      for (let field of Object.keys(fields)) {
        let fieldOptions = fields[field]

        if (!fieldOptions) {
          continue
        }

        let schema = getFieldSchema(model, field)
        let fieldName = fieldOptions.name ?? field
        let input = decodeFormValue(formData.get(fieldName), fieldOptions.type)
        let result = schema['~run'](input, { path: [field] })

        if (result.issues) {
          issues.push(...result.issues)
        } else {
          value[field] = result.value
        }
      }

      if (issues.length > 0) {
        return { success: false, issues }
      }

      return { success: true, value: value as FormValue<shape, fields> }
    },
  }
}

function getFieldSchema<shape extends ObjectShape>(
  model: ObjectSchema<shape>,
  field: string,
): Schema<any, unknown> {
  let schema: Schema<any, unknown> | undefined = model.shape[field]

  if (!schema) {
    throw new Error(`Unknown model field "${field}"`)
  }

  return schema
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
