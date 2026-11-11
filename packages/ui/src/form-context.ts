import { attrs, createMixin } from '@remix-run/component'
import type { ElementProps, Handle, RemixNode } from '@remix-run/component'
import { isFormField, validateField } from '@remix-run/data-schema/experimental/form'
import type {
  FormEntries,
  FormField,
  FormFieldKind,
  FormSchema,
  FormErrors,
  FormSubmission,
} from '@remix-run/data-schema/experimental/form'
import { pressableCss } from './lib/press.ts'
import { getConstraints } from './form-constraints.ts'
import type { GetConstraintsOptions } from './form-constraints.ts'
import { fieldValidity, formValidity, getGroupControls, getRepeatedValues } from './form-control.ts'
import type { FieldFeedback, FieldState, ValidatableControl } from './form-control.ts'

const bindingData = Symbol('form binding')
const textInputTypes = [
  'text',
  'email',
  'url',
  'search',
  'tel',
  'date',
  'month',
  'week',
  'time',
  'datetime-local',
  'color',
  'hidden',
  'radio',
  'button',
  'submit',
  'reset',
  'image',
] as const

/**
 * A live form field reference that can be passed to child components through props.
 *
 * This experimental API may change or be removed in patch releases.
 */
export interface FieldBinding<kind extends string = FormFieldKind | 'fields' | 'file' | 'files'> {
  /** The field's form decoding kind. */
  readonly kind: kind
  /** The submitted HTML name. */
  readonly name: string
  /** The scoped control ID; radio and grouped checkbox IDs also include option values. */
  readonly id: string
  /** The context-scoped error element ID. */
  readonly errorId: string
  /** Visible client errors or immediate server errors; read during rendering. */
  readonly errors: ReadonlyArray<string>
  /** Whether blur, invalid submission, or editing server feedback revealed client errors. */
  readonly touched: boolean
  /**
   * Replaces supplemental errors for the current control value without marking it touched.
   * @param messages Supplemental messages; an empty array clears them.
   */
  setCustomErrors(messages: ReadonlyArray<string>): void
}

/**
 * Typed bindings retaining the form kind of each submitted entry.
 *
 * This experimental API may change or be removed in patch releases.
 */
export type FieldBindings<entries extends FormEntries> = {
  readonly [key in keyof entries]: FieldBinding<
    entries[key] extends FormField<unknown, infer kind> ? kind : entries[key]['kind']
  >
}

/**
 * Current field references and grouped server errors for the render callback.
 *
 * This experimental API may change or be removed in patch releases.
 */
export interface FormContextValue<entries extends FormEntries> {
  /** Stable typed field bindings; read live properties during rendering. */
  fields: FieldBindings<entries>
  /** Current grouped server messages, including form-level business errors. */
  errors: FormErrors
}

/**
 * One rendered form's shared schema and current submission.
 *
 * This experimental API may change or be removed in patch releases.
 */
export interface FormContextProps<entries extends FormEntries> {
  /** Initial unique ID scope. Pass a client entry's handle.id to retain exact SSR IDs on hydration. */
  id?: string
  /** Stable inspectable form schema, also used by server parsing. */
  schema: FormSchema<entries>
  /** A new submission object resets feedback and refreshes failed values. */
  submission?: FormSubmission
  /** Renders application-owned markup with live fields and errors. */
  children(value: FormContextValue<entries>): RemixNode
}

interface FormContextState {
  getSubmission(): FormSubmission | undefined
  changed(previous: FieldState, current: FieldFeedback): void
}

interface BindingData {
  owner: FormContextState
  key: string
  entry: FormEntries[string]
  getFeedback(): FieldFeedback
}

type InternalBinding = FieldBinding<FormFieldKind | FormEntries[string]['kind']> & {
  [bindingData]: BindingData
}

/**
 * Owns a form instance's feedback and renders fields without setup factories or subscriptions.
 *
 * This experimental API may change or be removed in patch releases.
 *
 * @param handle Shared schema, submission props, component lifetime, and render callback.
 * @returns The application's form markup with live field bindings.
 */
export function Context<entries extends FormEntries>(
  handle: Handle<FormContextProps<entries>, FormContextState>,
): () => RemixNode {
  let schema = handle.props.schema
  let idPrefix = handle.props.id ?? handle.id
  if (!schema.entries)
    throw new Error('form.Context requires an inspectable data-schema/experimental/form object')
  let state: FormContextState = {
    getSubmission() {
      return handle.props.submission
    },
    changed(previous, current) {
      if (
        previous.touched !== current.touched ||
        previous.errors.length !== current.errors.length ||
        previous.errors.some((message, index) => message !== current.errors[index])
      ) {
        void handle.update()
      }
    },
  }
  handle.context.set(state)
  let bindings = Object.fromEntries(
    Object.entries(schema.entries).map(([key, entry]) => {
      let previousSubmission: FormSubmission | undefined
      let feedback: FieldFeedback | undefined
      let data: BindingData = {
        owner: state,
        key,
        entry,
        getFeedback() {
          let submission = state.getSubmission()
          if (!feedback || previousSubmission !== submission) {
            previousSubmission = submission
            let fieldErrors = submission?.errors.fields
            let errors = fieldErrors && Object.hasOwn(fieldErrors, key) ? fieldErrors[key] : []
            feedback = {
              touched: false,
              hasServerErrors: errors.length > 0,
              errors,
              customErrors: [],
              refreshControls: feedback?.refreshControls ?? new Set(),
            }
          }
          return feedback
        },
      }
      let keyId = encodeURIComponent(key)
      let id = `${idPrefix}-field-${keyId}`
      let binding: InternalBinding = {
        [bindingData]: data,
        kind: isFormField(entry) ? entry.formKind : entry.kind,
        name: entry.name ?? key,
        id,
        errorId: `${idPrefix}-error-${keyId}`,
        get errors() {
          return data.getFeedback().errors
        },
        get touched() {
          return data.getFeedback().touched
        },
        setCustomErrors(messages) {
          let feedback = data.getFeedback()
          feedback.customErrors = messages.filter((message) => message.length > 0)
          feedback.customValue = undefined
          for (let refresh of feedback.refreshControls) refresh()
        },
      }
      return [key, Object.freeze(binding)]
    }),
  )
  // Object.fromEntries erases the relationship between each entry key and its binding kind.
  let fields = Object.freeze(bindings) as unknown as FieldBindings<entries>
  return () => {
    if (handle.props.schema !== schema)
      throw new Error('Changing form schemas requires a new keyed Context')
    let submissionErrors = handle.props.submission?.errors
    let formErrors = submissionErrors?.form
    return handle.props.children({
      fields,
      errors: {
        fields: submissionErrors?.fields ?? {},
        ...(formErrors?.length ? { form: formErrors } : {}),
      },
    })
  }
}

function getBinding(field: FieldBinding<string>, owner: FormContextState): BindingData {
  if (!(bindingData in field)) throw new Error('Expected a field binding from form.Context')
  let data = (field as InternalBinding)[bindingData]
  if (data.owner !== owner)
    throw new Error('Field bindings must be used inside their owning form.Context')
  return data
}

/**
 * Native form coordination without intercepting submission or owning navigation.
 *
 * This experimental API may change or be removed in patch releases.
 */
export const root = createMixin<HTMLFormElement, [], ElementProps>((handle) => {
  if (!handle.context.get(Context)) throw new Error('form.root() requires form.Context')
  return () => formValidity()
})

/**
 * Native control validation, constraints, restored values, feedback, and error associations.
 *
 * This experimental API may change or be removed in patch releases.
 */
export const control = createMixin<ValidatableControl, [field: FieldBinding], ElementProps>(
  (handle, hostType) => {
    let owner = handle.context.get(Context)
    if (!owner) throw new Error('form.control() requires form.Context')
    return (field, props) => {
      let data = getBinding(field, owner)
      let entry = data.entry
      let scalar = isFormField(entry) ? entry : undefined
      if (!scalar && entry.kind !== 'fields' && entry.kind !== 'file' && entry.kind !== 'files')
        throw new Error('form.control() requires a form field, repeated text, or file entry')
      let kind = scalar ? scalar.formKind : entry.kind
      let repeated = kind === 'fields'
      let type: GetConstraintsOptions['type'] = scalar?.formKind ?? (repeated ? 'checkbox' : 'file')
      if (hostType === 'input') {
        let authoredType = String(props.type ?? type)
        let textType = textInputTypes.find((type) => type === authoredType)
        if (kind === 'text' && textType) type = textType
        else if (kind === 'number' && authoredType === 'range') type = 'range'
        else if (authoredType !== type)
          throw new Error(`Input type ${authoredType} is incompatible with form ${kind} decoding`)
      } else if (hostType === 'select' && (kind === 'text' || repeated)) {
        if ((repeated && props.multiple === false) || (!repeated && props.multiple))
          throw new Error('Multiple selects require fd.fields; single selects require fd.text')
      } else if (hostType !== 'textarea' || kind !== 'text') {
        throw new Error('Select and textarea controls require compatible text form entries')
      }
      let grouped = type === 'radio' || (repeated && hostType === 'input')
      let id = grouped ? optionId(field.id, props.value ?? 'on') : field.id
      if (['button', 'submit', 'reset', 'image'].includes(type))
        return attrs({ id, name: field.name, type })
      return fieldValidity(() => {
        let feedback = data.getFeedback()
        let constraints = getConstraints(entry.schema, {
          type: hostType === 'input' ? type : hostType,
          multiple: kind === 'files' || repeated,
        })
        if (scalar && scalar.empty === 'preserve' && !validateField(scalar, '').issues)
          delete constraints.required
        let attributes: Record<string, unknown> = {
          id,
          name: field.name,
          type,
          ...(type === 'file' ? { multiple: kind === 'files' } : {}),
          ...(repeated && hostType === 'select' ? { multiple: true } : {}),
          ...constraints,
        }
        let submission = owner.getSubmission()
        let value = submission?.values[data.key]
        if (repeated) {
          if (submission) {
            let values = Array.isArray(value) ? value : []
            if (hostType === 'select') attributes.defaultValue = values
            else attributes.defaultChecked = values.includes(String(props.value ?? 'on'))
          }
        } else if (type === 'radio') {
          if (submission)
            attributes.defaultChecked = !scalar?.sensitive && value === String(props.value ?? 'on')
        } else if ((kind === 'password' || scalar?.sensitive) && submission) {
          if (kind === 'checkbox') attributes.defaultChecked = false
          else attributes.defaultValue = ''
        } else if (type !== 'file' && typeof value === 'string') attributes.defaultValue = value
        else if (typeof value === 'boolean') attributes.defaultChecked = value
        if (feedback.hasServerErrors) attributes['data-form-error-id'] = field.errorId
        return {
          attrs: attributes,
          field: data.key,
          errorId: field.errorId,
          errorMap: scalar?.errorMap,
          feedback,
          repeated,
          validate(node) {
            let raw: unknown = repeated ? getRepeatedValues(node) : node.value
            if (!repeated && node instanceof HTMLInputElement) {
              if (type === 'radio') {
                raw = getGroupControls(node).find(
                  (control) =>
                    control instanceof HTMLInputElement &&
                    control.checked &&
                    !control.matches(':disabled'),
                )
                raw = raw instanceof HTMLInputElement ? raw.value : undefined
              } else if (type === 'file') {
                let files = [...(node.files ?? [])]
                raw = kind === 'files' ? files : files[0]
              } else if (kind === 'checkbox') raw = node.checked
            }
            let result = scalar
              ? validateField(scalar, raw, [data.key])
              : entry.schema['~run'](raw, { path: [data.key] })
            node.setCustomValidity(result.issues?.[0]?.message ?? '')
          },
          onFeedbackChange(previous) {
            owner.changed(previous, feedback)
          },
        }
      })
    }
  },
)

/**
 * Associates a label with a control; pass its value for radio or grouped checkbox options.
 *
 * This experimental API may change or be removed in patch releases.
 */
export const label = createMixin<
  HTMLLabelElement,
  [field: FieldBinding<string>, value?: string | number],
  ElementProps
>((handle) => {
  let owner = handle.context.get(Context)
  if (!owner) throw new Error('form.label() requires form.Context')
  return (field, value) => {
    getBinding(field, owner)
    return [
      attrs({
        htmlFor:
          typeof value === 'string' || typeof value === 'number'
            ? optionId(field.id, value)
            : field.id,
      }),
      // Labels are activated, not read: no text selection.
      pressableCss(),
    ]
  }
})

function optionId(id: string, value: unknown): string {
  return `${id}-option-${encodeURIComponent(String(value))}`
}

/**
 * Identifies application-owned error content without choosing its role or visibility.
 *
 * This experimental API may change or be removed in patch releases.
 */
export const error = createMixin<Element, [field: FieldBinding<string>], ElementProps>((handle) => {
  let owner = handle.context.get(Context)
  if (!owner) throw new Error('form.error() requires form.Context')
  return (field) => {
    getBinding(field, owner)
    return attrs({ id: field.errorId })
  }
})
