import { getSchemaMetadata } from '@remix-run/data-schema'
import type {
  ErrorMap,
  InferOutput,
  Issue,
  ObjectSchema,
  ObjectShape,
  Schema,
} from '@remix-run/data-schema'
import { attrs, createElement, createMixin, on, ref } from '@remix-run/component'
import type { Dispatched, ElementProps, MixinDescriptor } from '@remix-run/component'

type ValidatableControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
type FormMixin = MixinDescriptor<HTMLFormElement, [], ElementProps>
type FieldValidator = (control: ValidatableControl) => void
type FieldErrorMap = (context: {
  code: string
  defaultMessage: string
  path?: ReadonlyArray<string>
  values?: Record<string, unknown>
  input: unknown
}) => string | undefined

interface FieldMessageOptions {
  readonly errorMap?: FieldErrorMap
}
type FieldMixin = MixinDescriptor<
  ValidatableControl,
  [getConfig: () => FieldMixinConfig],
  ElementProps
>

interface FieldMixinConfig {
  attrs: object
  validate: FieldValidator
  field: string
  errorMap?: FieldErrorMap
  errorId: string
  feedback: FieldFeedback
  onFeedbackChange(previous: FieldState): void
}

interface FieldFeedback {
  touched: boolean
  hasServerErrors: boolean
  errors: ReadonlyArray<string>
  customErrors: ReadonlyArray<string>
  customValue?: string
  refreshControl?: () => void
}

interface FormDefinitionSource<fields extends Readonly<Record<string, unknown>>, submission> {
  readonly fields: fields & { readonly [field in keyof fields]: FieldMessageOptions }
  getInputAttrs<field extends keyof fields & string>(field: field, submission?: submission): object
  getLabelAttrs<field extends keyof fields & string>(field: field): { htmlFor: string }
  createInputValidator<field extends keyof fields & string>(field: field): FieldValidator
  getErrorAttrs<field extends keyof fields & string>(field: field): { id: string }
  getFieldErrors<field extends keyof fields & string>(
    field: field,
    submission?: submission,
  ): ReadonlyArray<string>
}

interface FieldDefinitionSource<submission> extends FieldMessageOptions {
  getInputAttrs(name: string, submission?: submission): object
  getLabelAttrs(name: string): { htmlFor: string }
  createInputValidator(name?: string): FieldValidator
  getErrorAttrs(name: string): { id: string }
  getFieldErrors(name: string, submission?: submission): ReadonlyArray<string>
}

/** Live, read-only feedback for one field. */
export interface FieldState {
  /** Visible client messages or server errors. */
  readonly errors: ReadonlyArray<string>
  /** Whether feedback was revealed by blur, invalid submission, or editing a server error. */
  readonly touched: boolean
}

/** Live field feedback with application-owned supplemental errors. */
export interface FieldBinding extends FieldState {
  /**
   * Replaces supplemental errors for the control's current value; `[]` clears them.
   * Updates native validity synchronously without marking the field touched. Messages survive
   * revalidation, but clear on a changed value, non-canceled reset, or new submission.
   * Native/schema errors remain primary. Async work and stale-result protection are caller-owned.
   * @param messages Supplemental messages; empty strings are ignored.
   */
  setCustomErrors(messages: ReadonlyArray<string>): void
}

/** Related mixins and live state for a single input, select, or textarea. */
export interface FieldMixins extends FieldBinding {
  /**
   * Applies native attributes, validation, interaction state, and error accessibility.
   * @returns A mixin for the native control.
   */
  field(): FieldMixin
  /**
   * Associates application-owned label markup with the native control.
   * @returns An attribute-only label mixin.
   */
  label(): ReturnType<typeof attrs<HTMLLabelElement>>
  /**
   * Identifies application-owned error markup without choosing its content or role.
   * @returns An attribute-only error mixin.
   */
  error(): ReturnType<typeof attrs<Element>>
}

/** Naming, current submission, and render notification for a standalone field. */
export interface FieldMixinsOptions<submission> extends FormMixinsOptions<submission> {
  /** Logical field name, used to read submission values and errors. */
  name: string
}

/** Dynamic submission data for setup-scoped form mixins. */
export interface FormMixinsOptions<submission> {
  /** Reads the current submission when rendering mixins or reading errors; does not subscribe. */
  getSubmission?: () => submission | undefined
  /** Requests rendering when visible errors or touched state change. */
  onChange?: () => void
}

/** Related validation mixins bound to one form definition. */
export interface FormMixins<fields extends Readonly<Record<string, unknown>>> {
  /** Stable field bindings; read live properties during rendering and supply custom errors. */
  readonly fields: { readonly [field in keyof fields & string]: FieldBinding }
  /** Stable, read-only object of current visible messages; read field arrays during rendering. */
  readonly errors: { readonly [field in keyof fields & string]: ReadonlyArray<string> }
  /**
   * Enhances the form's unmanaged native controls without duplicating managed input behavior.
   *
   * @returns A mixin for the native form element.
   */
  form(): FormMixin
  /**
   * Alias for `field()`; applies control attributes, validation, and error accessibility.
   *
   * @param field The projected field name.
   * @returns A mixin for the field's native input.
   */
  input<field extends keyof fields & string>(field: field): FieldMixin
  /**
   * Applies control attributes, validation, touched state, and error accessibility.
   * @param field The projected field name.
   * @returns A mixin for the field's native control.
   */
  field<field extends keyof fields & string>(field: field): FieldMixin
  /**
   * Associates application-owned label markup with the field's native control.
   * @param field The projected field name.
   * @returns An attribute-only label mixin.
   */
  label<field extends keyof fields & string>(
    field: field,
  ): ReturnType<typeof attrs<HTMLLabelElement>>
  /**
   * Applies the generated error-element id without controlling content, visibility, or role.
   *
   * @param field The projected field name.
   * @returns An attribute-only mixin for application-owned error markup.
   */
  error<field extends keyof fields & string>(field: field): ReturnType<typeof attrs<Element>>
}

const INPUT_VALIDATION_EVENT = 'rmx:input-validation' as const

declare global {
  interface HTMLElementEventMap {
    [INPUT_VALIDATION_EVENT]: InputValidationEvent
  }
}

/** Presentation-ready validation state for a model-backed input. */
export interface InputValidationState extends FieldState {
  /** The projected field name, independent of an overridden input name or id. */
  readonly field: string
  /** The generated id to apply to the application's error element. */
  readonly errorId: string
}

/** A bubbling notification for rendering application-owned field errors. */
export class InputValidationEvent extends Event implements InputValidationState {
  /** The projected field name. */
  readonly field: string
  /** The id of the application's error element. */
  readonly errorId: string
  /** The errors to display for this field. */
  readonly errors: ReadonlyArray<string>
  /** Whether client feedback has been revealed for this input. */
  readonly touched: boolean

  /**
   * Creates a validation notification.
   *
   * @param state The field's presentation-ready validation state.
   */
  constructor(state: InputValidationState) {
    super(INPUT_VALIDATION_EVENT, { bubbles: true })
    this.field = state.field
    this.errorId = state.errorId
    this.errors = [...state.errors]
    this.touched = state.touched
  }
}

const formValidity = createMixin<HTMLFormElement, [], ElementProps>(() => () => [
  on<HTMLFormElement>('focusout', (event) => {
    let control = getValidatableControl(event.target)

    if (control && !control.hasAttribute('data-form-input')) {
      control.setAttribute('data-touched', '')
      syncValidity(control)
    }
  }),
  on<HTMLFormElement>('input', (event) => {
    let control = getValidatableControl(event.target)

    if (!control || control.hasAttribute('data-form-input')) {
      return
    }

    let hadServerError = control.hasAttribute('data-form-error-id')

    if (hadServerError) {
      clearServerError(control)
    }

    if (hadServerError || control.hasAttribute('data-touched')) {
      syncValidity(control)
    }
  }),
  on<HTMLFormElement>(
    'invalid',
    (event) => {
      let control = getValidatableControl(event.target)

      if (control && !control.hasAttribute('data-form-input')) {
        control.setAttribute('data-touched', '')
        syncValidity(control)
      }
    },
    true,
  ),
])

const fieldValidity = createMixin<
  ValidatableControl,
  [getConfig: () => FieldMixinConfig],
  ElementProps
>((handle, hostType) => {
  let previousConfig: FieldMixinConfig | undefined
  let mountedControl: ValidatableControl | undefined
  let resetControl: (control: ValidatableControl) => void

  handle.addEventListener('insert', (event) => {
    mountedControl = event.node
    if (previousConfig) {
      let { feedback } = previousConfig
      let key = getControlKey(event.node)
      if (feedback.customValue !== undefined && feedback.customValue !== key) {
        feedback.customErrors = []
      }
      feedback.customValue = key
      validateInput(event.node, previousConfig, feedback.customErrors)
    }
  })

  handle.addEventListener('remove', () => {
    mountedControl = undefined
    if (previousConfig) previousConfig.feedback.refreshControl = undefined
  })

  return (getConfig, props) => {
    let config = getConfig()
    let feedback = config.feedback
    if (previousConfig && previousConfig.feedback !== feedback) {
      previousConfig.feedback.refreshControl = undefined
      handle.queueTask(() => {
        if (mountedControl && previousConfig?.feedback === feedback) {
          updateFeedback(mountedControl, 'sync')
        }
      })
    }
    previousConfig = config

    function getFeedbackProps(): ElementProps {
      let { touched, hasServerErrors, errors } = feedback
      let attrs: ElementProps = { ...config.attrs, ...props }
      if (hostType !== 'input') {
        delete attrs.type
        delete attrs.defaultChecked
      }
      if (hostType === 'select') delete attrs.defaultValue
      let describedBy =
        typeof attrs['aria-describedby'] === 'string'
          ? attrs['aria-describedby'].split(/\s+/).filter((id) => id && id !== config.errorId)
          : []
      if (errors.length > 0) describedBy.push(config.errorId)

      return {
        ...attrs,
        'data-form-input': '',
        'data-touched': touched ? '' : undefined,
        'data-form-error-id': hasServerErrors ? config.errorId : undefined,
        'aria-invalid': props['aria-invalid'] ?? (errors.length > 0 ? 'true' : undefined),
        'aria-describedby': describedBy.length > 0 ? describedBy.join(' ') : undefined,
      }
    }

    function updateFeedback(
      input: ValidatableControl,
      reason: 'input' | 'focusout' | 'invalid' | 'reset' | 'custom' | 'sync',
    ) {
      let previous = { ...feedback }
      let key = getControlKey(input)
      if (
        reason === 'reset' ||
        (feedback.customValue !== undefined && feedback.customValue !== key)
      ) {
        feedback.customErrors = []
      }
      feedback.customValue = key
      let errors = validateInput(input, config, feedback.customErrors)

      if (reason === 'input') {
        feedback.touched ||= feedback.hasServerErrors
        feedback.hasServerErrors = false
      } else if (reason === 'reset') {
        feedback.touched = false
        feedback.hasServerErrors = false
      } else if (reason === 'focusout' || reason === 'invalid') {
        feedback.touched = true
      }

      if (!feedback.hasServerErrors) {
        feedback.errors = feedback.touched ? errors : []
      }

      let props = getFeedbackProps()
      setAttribute(input, 'aria-invalid', props['aria-invalid'])
      setAttribute(input, 'aria-describedby', props['aria-describedby'])
      input.toggleAttribute('data-touched', feedback.touched)
      if (!feedback.hasServerErrors) input.removeAttribute('data-form-error-id')

      config.onFeedbackChange(previous)

      input.dispatchEvent(
        new InputValidationEvent({
          field: config.field,
          errorId: config.errorId,
          errors: feedback.errors,
          touched: feedback.touched,
        }),
      )
    }

    feedback.refreshControl = function refreshControl() {
      let nextConfig = getConfig()
      if (nextConfig.feedback !== feedback) feedback.refreshControl = undefined
      config = nextConfig
      feedback = config.feedback
      feedback.refreshControl = refreshControl
      previousConfig = config
      if (mountedControl) updateFeedback(mountedControl, 'custom')
    }
    resetControl = (control) => updateFeedback(control, 'reset')

    return createElement(handle.element, {
      ...getFeedbackProps(),
      mix: [
        ref((control: ValidatableControl, signal) => {
          control.form?.addEventListener(
            'reset',
            (event) => {
              queueMicrotask(() => {
                if (!event.defaultPrevented && !signal.aborted) resetControl(control)
              })
            },
            { signal },
          )
        }),
        on<ValidatableControl>('input', (event) => updateFeedback(event.currentTarget, 'input')),
        on<ValidatableControl>('change', (event) => updateFeedback(event.currentTarget, 'input')),
        on<ValidatableControl>('focusout', (event) =>
          updateFeedback(event.currentTarget, 'focusout'),
        ),
        on<ValidatableControl>('invalid', (event) =>
          updateFeedback(event.currentTarget, 'invalid'),
        ),
      ],
    })
  }
})

/**
 * Enhances unmanaged native controls with touched state and accessible invalid attributes.
 *
 * @returns A mixin for a native form element.
 */
export function form(): FormMixin {
  return formValidity()
}

/**
 * Binds one reusable field definition to a native control without requiring a form binding.
 *
 * Create once in component setup. State properties remain live across renders; a new submission
 * resets touched state. `onChange` fires when errors or touched state change.
 * A field definition's `errorMap` customizes supported native failures as well as schema errors.
 *
 * @param fieldDefinition Shared field attributes, validation, and server error readers.
 * @param options Logical name, submission getter, and optional render notification.
 * @returns Control, label, and error mixins with live read-only state.
 */
export function createFieldMixins<submission>(
  fieldDefinition: FieldDefinitionSource<submission>,
  options: FieldMixinsOptions<submission>,
): FieldMixins {
  let previousSubmission: submission | undefined
  let feedback: FieldFeedback | undefined

  function getFeedback(): FieldFeedback {
    let submission = options.getSubmission?.()
    if (!feedback || submission !== previousSubmission) {
      previousSubmission = submission
      let errors = fieldDefinition.getFieldErrors(options.name, submission)
      feedback = {
        touched: false,
        hasServerErrors: errors.length > 0,
        errors,
        customErrors: [],
        refreshControl: feedback?.refreshControl,
      }
    }
    return feedback
  }

  return Object.freeze({
    get errors() {
      return getFeedback().errors
    },
    get touched() {
      return getFeedback().touched
    },
    setCustomErrors(messages: ReadonlyArray<string>) {
      let feedback = getFeedback()
      feedback.customErrors = messages.filter((message) => message.length > 0)
      feedback.customValue = undefined
      feedback.refreshControl?.()
    },
    field() {
      return fieldValidity(() => {
        let feedback = getFeedback()
        return {
          attrs: fieldDefinition.getInputAttrs(options.name, options.getSubmission?.()),
          validate: fieldDefinition.createInputValidator(options.name),
          field: options.name,
          errorMap: fieldDefinition.errorMap,
          errorId: fieldDefinition.getErrorAttrs(options.name).id,
          feedback,
          onFeedbackChange(previous) {
            if (getFeedback() !== feedback) return
            if (
              previous.touched !== feedback.touched ||
              previous.errors.length !== feedback.errors.length ||
              previous.errors.some((message, index) => message !== feedback.errors[index])
            ) {
              options.onChange?.()
            }
          },
        }
      })
    },
    label() {
      return attrs<HTMLLabelElement>(fieldDefinition.getLabelAttrs(options.name))
    },
    error() {
      return attrs(fieldDefinition.getErrorAttrs(options.name))
    },
  })
}

/**
 * Binds form and control mixins to a schema-backed form definition.
 *
 * Supplies SSR attributes, restored values, native-first validation, and error accessibility.
 * Client feedback appears after blur or a blocked submission; render live `fields.name.errors`
 * in application-owned markup linked with `error(name)`. Explicit host props win.
 * Create once in setup. `getSubmission` reads current state during rendering or field access;
 * a new submission resets feedback without firing `onChange`. Use `onChange` to request a render
 * when visible errors or touched state change.
 *
 * @param formDefinition Form definition that provides attributes, errors, and field validators.
 * @param options Current submission source and render notification (optional).
 * @returns Related form, control, label, and error mixin factories, plus live field state.
 */
export function createFormMixins<fields extends Readonly<Record<string, unknown>>, submission>(
  formDefinition: FormDefinitionSource<fields, submission>,
  options: FormMixinsOptions<submission> = {},
): FormMixins<fields> {
  let bindings: Record<string, FieldMixins> = {}
  let fieldStates: Record<string, FieldBinding> = {}
  let errors: Record<string, ReadonlyArray<string>> = {}

  for (let field in formDefinition.fields) {
    if (!Object.hasOwn(formDefinition.fields, field)) continue
    Object.defineProperty(bindings, field, {
      enumerable: true,
      value: createFieldMixins(
        {
          errorMap: formDefinition.fields[field].errorMap,
          getInputAttrs(_name, submission) {
            return formDefinition.getInputAttrs(field, submission)
          },
          createInputValidator() {
            return formDefinition.createInputValidator(field)
          },
          getLabelAttrs() {
            return formDefinition.getLabelAttrs(field)
          },
          getErrorAttrs() {
            return formDefinition.getErrorAttrs(field)
          },
          getFieldErrors(_name, submission) {
            return formDefinition.getFieldErrors(field, submission)
          },
        },
        { ...options, name: field },
      ),
    })
    Object.defineProperty(errors, field, {
      enumerable: true,
      get() {
        return bindings[field].errors
      },
    })
    Object.defineProperty(fieldStates, field, { enumerable: true, value: bindings[field] })
  }

  return {
    // Every own projected field has one independent binding installed above.
    fields: Object.freeze(fieldStates) as FormMixins<fields>['fields'],
    // Every own projected field has a live getter installed above.
    errors: Object.freeze(errors) as FormMixins<fields>['errors'],
    form() {
      return formValidity()
    },
    input(field) {
      return getBinding(field).field()
    },
    field(field) {
      return getBinding(field).field()
    },
    label(field) {
      return getBinding(field).label()
    },
    error(field) {
      return getBinding(field).error()
    },
  }

  function getBinding(field: keyof fields & string): FieldMixins {
    if (!Object.hasOwn(bindings, field)) throw new Error(`Unknown form field "${field}"`)
    return bindings[field]
  }
}

/**
 * Observes field feedback without taking ownership of its markup or disabling default behavior.
 *
 * @param handler Receives the field, error element id, visible errors, and touched state.
 * @param captureBoolean Whether to listen during capture (false by default).
 * @returns An event mixin for an input or an ancestor such as its form.
 */
export function onInputValidation<target extends HTMLElement>(
  handler: (
    event: Dispatched<InputValidationEvent, target>,
    signal: AbortSignal,
  ) => void | Promise<void>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof INPUT_VALIDATION_EVENT>> {
  return on(INPUT_VALIDATION_EVENT, handler, captureBoolean)
}

function validateInput(
  input: ValidatableControl,
  config: Pick<FieldMixinConfig, 'validate' | 'field' | 'errorMap'>,
  customErrors: ReadonlyArray<string> = [],
): ReadonlyArray<string> {
  let previousMessage = input.validity.customError ? input.validationMessage : ''
  input.setCustomValidity('')
  try {
    if (input.validity.valid) {
      config.validate(input)
    } else if (config.errorMap) {
      let issue = getNativeIssue(input)
      if (issue) {
        let message = config.errorMap({
          ...issue,
          defaultMessage: input.validationMessage,
          path: [config.field],
          input: getControlValue(input),
        })
        if (message !== undefined) input.setCustomValidity(message)
      }
    }
    let message = input.validationMessage
    let errors = message ? [message, ...customErrors] : customErrors
    if (input.validity.valid) input.setCustomValidity(customErrors[0] ?? '')
    return errors
  } catch (error) {
    input.setCustomValidity(previousMessage || customErrors[0] || '')
    throw error
  }
}

function getNativeIssue(
  input: ValidatableControl,
): { code: string; values?: Record<string, unknown> } | undefined {
  let validity = input.validity
  let type = input instanceof HTMLInputElement ? input.type : undefined
  if (validity.valueMissing) return { code: 'value.required' }
  if (validity.badInput) return type === 'number' ? { code: 'type.number' } : undefined
  if (validity.typeMismatch) {
    if (type === 'email') return { code: 'string.email' }
    if (type === 'url') return { code: 'string.url' }
    return undefined
  }
  // Native-only constraints keep browser wording, even when another flag is also set.
  if (validity.patternMismatch) return undefined
  if (!(input instanceof HTMLSelectElement)) {
    if (validity.tooLong) return { code: 'string.max_length', values: { max: input.maxLength } }
    if (validity.tooShort) return { code: 'string.min_length', values: { min: input.minLength } }
  }
  if (input instanceof HTMLInputElement && type === 'number') {
    if (validity.rangeUnderflow) return { code: 'number.min', values: { min: Number(input.min) } }
    if (validity.rangeOverflow) return { code: 'number.max', values: { max: Number(input.max) } }
  }
}

function getControlValue(input: ValidatableControl): unknown {
  if (input instanceof HTMLInputElement) {
    if (input.type === 'checkbox') return input.checked
    if (input.type === 'number') {
      if (input.validity.badInput) return NaN
      return input.value.trim() === '' ? undefined : Number(input.value)
    }
  }
  return input.value === '' ? undefined : input.value
}

function getControlKey(control: ValidatableControl): string {
  return JSON.stringify([
    control.value,
    control instanceof HTMLInputElement ? control.checked : undefined,
  ])
}

function setAttribute(element: HTMLElement, name: string, value: unknown): void {
  if (value === undefined || value === null) {
    element.removeAttribute(name)
  } else {
    element.setAttribute(name, String(value))
  }
}

function getValidatableControl(target: EventTarget | null): ValidatableControl | undefined {
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
  ) {
    return target
  }
}

function syncValidity(control: ValidatableControl): void {
  if (control.validity.valid) {
    control.removeAttribute('aria-invalid')
  } else {
    control.setAttribute('aria-invalid', 'true')
  }
}

function clearServerError(control: ValidatableControl): void {
  let errorId = control.getAttribute('data-form-error-id')

  if (!errorId) {
    return
  }

  let describedBy = control
    .getAttribute('aria-describedby')
    ?.split(/\s+/)
    .filter((id) => id && id !== errorId)

  if (describedBy && describedBy.length > 0) {
    control.setAttribute('aria-describedby', describedBy.join(' '))
  } else {
    control.removeAttribute('aria-describedby')
  }

  let error = control.ownerDocument.getElementById(errorId)

  if (error instanceof HTMLElement) {
    error.hidden = true
  }

  control.removeAttribute('data-form-error-id')
}

/**
 * Native HTML constraints that can be derived from a schema's checks.
 */
export interface SchemaConstraints {
  /** Whether the input must contain a value or a checkbox must be checked. */
  required?: true
  /** The minimum text length accepted by the schema. */
  minLength?: number
  /** The maximum text length accepted by the schema. */
  maxLength?: number
  /** The minimum numeric value accepted by the schema. */
  min?: number
  /** The maximum numeric value accepted by the schema. */
  max?: number
  /** The interval accepted by a numeric input. */
  step?: number | 'any'
}

/**
 * Input control context used to derive native HTML constraints.
 */
export interface GetConstraintsOptions {
  /** The native input type and its corresponding empty-value semantics. */
  type: 'checkbox' | 'email' | 'number' | 'password' | 'text' | 'url'
}

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
   * Customizes schema failures during parsing and supported native failures in the browser.
   * Return `undefined` to keep the default. Required empty values use `value.required`;
   * other failures use schema/domain codes. Supplemental `setCustomErrors` are not mapped.
   * Explicit refinement messages and uncoded checks bypass the map, matching schema parsing.
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
 * Only configured field schemas run during parsing; cross-field validation is caller-owned.
 *
 * @param options The optional backing schema and UI configuration for the included fields.
 * @returns A form definition that derives native attributes and validates `FormData`.
 * @example
 * ```ts
 * import * as s from 'remix/data-schema'
 * import { createForm } from '@remix-run/ui/form'
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

/**
 * Returns native HTML constraints represented by a schema's recognized checks.
 *
 * Checks without an equivalent native constraint are omitted. Requiredness may evaluate the
 * schema with `undefined` or `false` when metadata alone cannot determine it.
 *
 * @param schema The schema to inspect.
 * @param options The input control receiving the constraints.
 * @returns Constraint attributes that can be spread onto a native `input` element.
 */
export function getConstraints<input, output>(
  schema: Schema<input, output>,
  options: GetConstraintsOptions,
): SchemaConstraints {
  let constraints: SchemaConstraints = {}

  if (options.type === 'number') {
    constraints.step = 'any'
  }

  if (
    options.type === 'checkbox'
      ? !schemaAcceptsValue(schema, false)
      : !schemaAcceptsUndefined(schema)
  ) {
    constraints.required = true
  }

  for (let check of getSchemaMetadata(schema).checks) {
    switch (check.code) {
      case 'string.min_length': {
        let minLength = getConstraintValue(check.values, 'min')
        if (minLength !== undefined) constraints.minLength = minLength
        break
      }
      case 'string.max_length': {
        let maxLength = getConstraintValue(check.values, 'max')
        if (maxLength !== undefined) constraints.maxLength = maxLength
        break
      }
      case 'number.min': {
        let min = getConstraintValue(check.values, 'min')
        if (min !== undefined) constraints.min = min
        break
      }
      case 'number.max': {
        let max = getConstraintValue(check.values, 'max')
        if (max !== undefined) constraints.max = max
        break
      }
    }
  }

  return constraints
}

function schemaAcceptsUndefined<input, output>(schema: Schema<input, output>): boolean {
  let acceptsUndefined = getSchemaMetadata(schema).acceptsUndefined

  if (acceptsUndefined !== undefined) {
    return acceptsUndefined
  }

  return !schema['~run'](undefined, { path: [] }).issues
}

function schemaAcceptsValue<input, output>(schema: Schema<input, output>, value: unknown): boolean {
  return !schema['~run'](value, { path: [] }).issues
}

function getConstraintValue(
  values: Record<string, unknown> | undefined,
  key: string,
): number | undefined {
  let value = values?.[key]
  return typeof value === 'number' ? value : undefined
}
