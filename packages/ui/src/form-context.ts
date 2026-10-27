import { attrs, createMixin } from '@remix-run/component'
import type { ElementProps, Handle, RemixNode } from '@remix-run/component'
import { isFormField, validateField } from '@remix-run/data-schema/form'
import type {
  FormEntries,
  FormField,
  FormFieldKind,
  FormSchema,
  FormErrors,
  FormSubmission,
} from '@remix-run/data-schema/form'
import { getConstraints } from './form-constraints.ts'
import { fieldValidity, formValidity } from './form-control.ts'
import type { FieldFeedback, FieldState, ValidatableControl } from './form-control.ts'

const bindingData = Symbol('form binding')

/** A live form field reference that can be passed to child components through props. */
export interface FieldBinding<kind extends string = FormFieldKind> {
  /** The field's form decoding kind. */
  readonly kind: kind
  /** The submitted HTML name. */
  readonly name: string
  /** The context-scoped native control ID. */
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

/** Typed bindings retaining the form kind of each submitted entry. */
export type FieldBindings<entries extends FormEntries> = {
  readonly [key in keyof entries]: FieldBinding<
    entries[key] extends FormField<unknown, infer kind> ? kind : entries[key]['kind']
  >
}

/** Current field references and grouped server errors for the render callback. */
export interface FormContextValue<entries extends FormEntries> {
  /** Stable typed field bindings; read live properties during rendering. */
  fields: FieldBindings<entries>
  /** Current grouped server messages, including form-level business errors. */
  errors: FormErrors
}

/** One rendered form's shared schema and current submission. */
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
 * @param handle Shared schema, submission props, component lifetime, and render callback.
 * @returns The application's form markup with live field bindings.
 */
export function Context<entries extends FormEntries>(
  handle: Handle<FormContextProps<entries>, FormContextState>,
): () => RemixNode {
  let schema = handle.props.schema
  let idPrefix = handle.props.id ?? handle.id
  if (!schema.entries)
    throw new Error('form.Context requires an inspectable data-schema/form object')
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
              refreshControl: feedback?.refreshControl,
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
          feedback.refreshControl?.()
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

/** Native form coordination without intercepting submission or owning navigation. */
export const root = createMixin<HTMLFormElement, [], ElementProps>((handle) => {
  if (!handle.context.get(Context)) throw new Error('form.root() requires form.Context')
  return () => formValidity()
})

/** Native control validation, constraints, restored values, feedback, and error associations. */
export const control = createMixin<ValidatableControl, [field: FieldBinding], ElementProps>(
  (handle, hostType) => {
    let owner = handle.context.get(Context)
    if (!owner) throw new Error('form.control() requires form.Context')
    return (field, props) => {
      let data = getBinding(field, owner)
      let entry = data.entry
      if (!isFormField(entry)) throw new Error('form.control() supports scalar form entries only')
      let kind = entry.formKind
      let type = props.type ?? kind
      if (hostType === 'input') {
        let compatible =
          kind === 'text'
            ? ['text', 'email', 'url', 'search', 'tel'].includes(String(type))
            : type === kind
        if (!compatible)
          throw new Error(`Input type ${String(type)} is incompatible with form ${kind} decoding`)
      } else if ((hostType !== 'select' && hostType !== 'textarea') || kind !== 'text') {
        throw new Error('Only text form entries support select and textarea controls')
      }
      return fieldValidity(() => {
        let feedback = data.getFeedback()
        let constraints = getConstraints(entry.schema, { type: kind })
        if (entry.empty === 'preserve' && !validateField(entry, '').issues)
          delete constraints.required
        let attributes: Record<string, unknown> = {
          id: field.id,
          name: field.name,
          type: kind,
          ...constraints,
        }
        let submission = owner.getSubmission()
        let value = submission?.values[data.key]
        if (kind === 'password' && submission) attributes.defaultValue = ''
        else if (typeof value === 'string') attributes.defaultValue = value
        else if (typeof value === 'boolean') attributes.defaultChecked = value
        if (feedback.hasServerErrors) attributes['data-form-error-id'] = field.errorId
        return {
          attrs: attributes,
          field: data.key,
          errorId: field.errorId,
          errorMap: entry.errorMap,
          feedback,
          validate(node) {
            let raw =
              kind === 'checkbox' && node instanceof HTMLInputElement ? node.checked : node.value
            let result = validateField(entry, raw, [data.key])
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

/** Associates an application-owned label with a field's scoped control. */
export const label = createMixin<HTMLLabelElement, [field: FieldBinding<string>], ElementProps>(
  (handle) => {
    let owner = handle.context.get(Context)
    if (!owner) throw new Error('form.label() requires form.Context')
    return (field) => {
      getBinding(field, owner)
      return attrs({ htmlFor: field.id })
    }
  },
)

/** Identifies application-owned error content without choosing its role or visibility. */
export const error = createMixin<Element, [field: FieldBinding<string>], ElementProps>((handle) => {
  let owner = handle.context.get(Context)
  if (!owner) throw new Error('form.error() requires form.Context')
  return (field) => {
    getBinding(field, owner)
    return attrs({ id: field.errorId })
  }
})
