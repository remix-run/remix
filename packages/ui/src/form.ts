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
   * Applies generated attributes, validation, touched state, and error accessibility to an input.
   *
   * @param field The projected field name.
   * @returns A mixin for the field's native input.
   */
  input<field extends keyof fields & string>(field: field): FieldMixin
  /**
   * Applies validation to a native input, select, or textarea.
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
 * Binds form and input validation mixins to a model-backed form definition.
 *
 * Applies native constraints and restored server values during SSR. In the browser, it validates
 * on input, reveals feedback after blur or an invalid submission, and owns error accessibility.
 * Render the live `errors` arrays in application-owned markup and apply `error(field)` to link it.
 * Explicit host props override generated attributes; error ids are appended to `aria-describedby`.
 * Create the binding in component setup and use `getSubmission` to read changing submission props.
 * The getter is evaluated while reading errors or rendering inputs, including SSR, not on binding.
 * Use `onChange` to request a render when visible errors or touched state change. New submissions
 * reset feedback without calling `onChange`; ordinary renders preserve it.
 * Each field's `errorMap` also resolves supported native constraint messages.
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
