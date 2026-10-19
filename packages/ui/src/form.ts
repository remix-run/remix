import { attrs, createElement, createMixin, on, ref } from '@remix-run/component'
import type { Dispatched, ElementProps, MixinDescriptor } from '@remix-run/component'

type ValidatableControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
type FormMixin = MixinDescriptor<HTMLFormElement, [], ElementProps>
type FieldValidator = (control: ValidatableControl) => void
type FieldMixin = MixinDescriptor<
  ValidatableControl,
  [getConfig: () => FieldMixinConfig],
  ElementProps
>

interface FieldMixinConfig {
  attrs: object
  validate: FieldValidator
  field: string
  errorId: string
  feedback: FieldFeedback
  validation?: FieldValidationOptions
  isCurrent(): boolean
  onFeedbackChange(previous: FieldState): void
}

interface FieldFeedback {
  touched: boolean
  hasServerErrors: boolean
  errors: ReadonlyArray<string>
  pending: boolean
  validationError: unknown
  cancelValidation?: () => void
}

interface FormDefinitionSource<fields extends Readonly<Record<string, unknown>>, submission> {
  readonly fields: fields
  getInputAttrs<field extends keyof fields & string>(field: field, submission?: submission): object
  getLabelAttrs<field extends keyof fields & string>(field: field): { htmlFor: string }
  createInputValidator<field extends keyof fields & string>(field: field): FieldValidator
  getErrorAttrs<field extends keyof fields & string>(field: field): { id: string }
  getFieldErrors<field extends keyof fields & string>(
    field: field,
    submission?: submission,
  ): ReadonlyArray<string>
}

interface FieldDefinitionSource<submission> {
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
  /** Whether a supplemental check is scheduled or awaiting a result; not an invalid state. */
  readonly pending: boolean
  /** A thrown/rejected supplemental check, distinct from validation messages. */
  readonly validationError: unknown
}

/** Related mixins and live state for a single input, select, or textarea. */
export interface FieldMixins extends FieldState {
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
export interface FieldMixinsOptions<submission> extends SubmissionBindingOptions<submission> {
  /** Logical field name, used to read submission values and errors. */
  name: string
  /** Supplemental client checks for this field, after native and schema validation. */
  validations?: FieldValidation | FieldValidationOptions
}

/** Browser context for a supplemental field validation. */
export interface FieldValidationContext {
  /** Aborted when superseded, reset, unmounted, or replaced by a server submission. */
  signal: AbortSignal
  /** The native control; use `checked` for checkbox-specific checks. */
  control: ValidatableControl
}

/**
 * Checks a snapshot of the control's raw string value; return no messages when valid.
 * These checks supplement, but never replace, authoritative server validation.
 */
export type FieldValidation = (
  value: string,
  context: FieldValidationContext,
) => ReadonlyArray<string> | Promise<ReadonlyArray<string>>

/** Supplemental validation and its typing delay. */
export interface FieldValidationOptions {
  /** Runs after native and schema constraints pass. */
  validate: FieldValidation
  /** Delay in milliseconds after input/change; blur runs immediately (300 by default). */
  debounceMs?: number
}

/** Dynamic submission data for setup-scoped form mixins. */
interface SubmissionBindingOptions<submission> {
  /** Reads the current submission when rendering mixins or reading errors; does not subscribe. */
  getSubmission?: () => submission | undefined
  /** Requests rendering when errors, touched, pending, or validationError change. */
  onChange?: () => void
}

/** Per-field supplemental client checks for a form binding. */
export interface FormMixinsOptions<
  submission,
  fields extends Readonly<Record<string, unknown>> = Readonly<Record<string, unknown>>,
> extends SubmissionBindingOptions<submission> {
  /** Checks keyed by projected field name; callbacks use a 300ms typing delay by default. */
  validations?: {
    [field in keyof fields & string]?: FieldValidation | FieldValidationOptions
  }
}

/** Related validation mixins bound to one form definition. */
export interface FormMixins<fields extends Readonly<Record<string, unknown>>> {
  /** Stable, read-only field states; read their live properties during rendering. */
  readonly fields: { readonly [field in keyof fields & string]: FieldState }
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
  /** Whether a supplemental check is scheduled or awaiting a result. */
  readonly pending: boolean
  /** A failed supplemental check, rather than a validation message. */
  readonly validationError: unknown

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
    this.pending = state.pending
    this.validationError = state.validationError
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
  let customErrors: ReadonlyArray<string> = []
  let validatedValue: string | undefined
  let controller: AbortController | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let runScheduled: (() => void) | undefined
  let mountedControl: ValidatableControl | undefined
  let resetControl: (control: ValidatableControl) => void
  let publishCurrent: (control: ValidatableControl, previous: FieldState) => void
  let updatingFeedback = false

  function cancelValidation() {
    controller?.abort()
    controller = undefined
    clearTimeout(timer)
    timer = undefined
    runScheduled = undefined
  }

  handle.addEventListener('insert', (event) => {
    if (previousConfig) {
      validateInput(event.node, previousConfig.validate)
    }
  })

  return (getConfig, props) => {
    let config = getConfig()
    let feedback = config.feedback
    if (previousConfig?.feedback !== feedback) {
      cancelValidation()
      customErrors = []
      validatedValue = undefined
      if (mountedControl) {
        handle.queueTask(() => {
          if (mountedControl && config.isCurrent()) validateInput(mountedControl, config.validate)
        })
      }
    }
    feedback.cancelValidation = cancelValidation
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
      reason: 'input' | 'focusout' | 'invalid' | 'reset',
    ) {
      validateInput(input, config.validate)
      let previous = { ...feedback }
      updatingFeedback = true

      if (reason === 'input') {
        feedback.touched ||= feedback.hasServerErrors
        feedback.hasServerErrors = false
      } else if (reason === 'reset') {
        feedback.touched = false
        feedback.hasServerErrors = false
      } else {
        feedback.touched = true
      }

      let key = getControlKey(input)
      if (reason === 'reset' || !input.validity.valid) {
        cancelValidation()
        customErrors = []
        validatedValue = undefined
        feedback.pending = false
        feedback.validationError = undefined
      } else if (config.validation && !feedback.hasServerErrors) {
        if (validatedValue !== key || feedback.validationError !== undefined) {
          cancelValidation()
          customErrors = []
          validatedValue = key
          feedback.pending = true
          feedback.validationError = undefined
          let request = new AbortController()
          controller = request
          let value = input.value
          let validation = config.validation

          function complete(errors: ReadonlyArray<string>, error?: unknown) {
            if (!config.isCurrent() || request.signal.aborted) return
            let previous = { ...feedback }
            feedback.pending = false
            feedback.validationError = error
            if (getControlKey(input) === key) {
              // Recheck native/schema constraints in case application code changed attributes.
              validateInput(input, config.validate)
              if (input.validity.valid) {
                customErrors = [...errors]
                input.setCustomValidity(customErrors[0] ?? '')
              }
            }
            if (!updatingFeedback) publishCurrent(input, previous)
          }

          let run = () => {
            timer = undefined
            runScheduled = undefined
            if (!config.isCurrent() || request.signal.aborted) return
            let result: ReturnType<FieldValidation>
            try {
              result = validation.validate(value, { control: input, signal: request.signal })
            } catch (error) {
              complete([], error)
              return
            }
            if (isValidationPromise(result)) {
              void result.then(
                (errors) => complete(errors),
                (error: unknown) => complete([], error),
              )
            } else {
              complete(result)
            }
          }
          let delay = reason === 'input' ? (validation.debounceMs ?? 300) : 0
          if (delay > 0) {
            runScheduled = run
            timer = setTimeout(run, delay)
          } else {
            run()
          }
        } else if (reason !== 'input' && runScheduled) {
          clearTimeout(timer)
          runScheduled()
        }
        input.setCustomValidity(customErrors[0] ?? '')
      }

      updatingFeedback = false
      publishFeedback(input, previous)
    }

    function publishFeedback(input: ValidatableControl, previous: FieldState) {
      if (!feedback.hasServerErrors) {
        feedback.errors =
          feedback.touched && input.validationMessage
            ? customErrors.length > 0
              ? customErrors
              : [input.validationMessage]
            : []
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
          pending: feedback.pending,
          validationError: feedback.validationError,
        }),
      )
    }

    resetControl = (control) => updateFeedback(control, 'reset')
    publishCurrent = publishFeedback

    return createElement(handle.element, {
      ...getFeedbackProps(),
      mix: [
        ref((control: ValidatableControl, signal) => {
          mountedControl = control
          signal.addEventListener(
            'abort',
            () => {
              cancelValidation()
              if (previousConfig) previousConfig.feedback.pending = false
              mountedControl = undefined
            },
            { once: true },
          )
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
 * resets feedback and cancels pending checks. `onChange` fires when live field state changes.
 * Supplemental `validations` run after native/schema checks, with debounced input and immediate
 * blur. Pending checks do not block submission; completed errors use `setCustomValidity()`.
 *
 * @param fieldDefinition Shared field attributes, validation, and server error readers.
 * @param options Logical name, submission getter, supplemental checks, and render notification.
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
      feedback?.cancelValidation?.()
      previousSubmission = submission
      let errors = fieldDefinition.getFieldErrors(options.name, submission)
      feedback = {
        touched: false,
        hasServerErrors: errors.length > 0,
        errors,
        pending: false,
        validationError: undefined,
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
    get pending() {
      return getFeedback().pending
    },
    get validationError() {
      return getFeedback().validationError
    },
    field() {
      return fieldValidity(() => {
        let feedback = getFeedback()
        return {
          attrs: fieldDefinition.getInputAttrs(options.name, options.getSubmission?.()),
          validate: fieldDefinition.createInputValidator(options.name),
          field: options.name,
          errorId: fieldDefinition.getErrorAttrs(options.name).id,
          feedback,
          validation:
            typeof options.validations === 'function'
              ? { validate: options.validations }
              : options.validations,
          isCurrent: () => getFeedback() === feedback,
          onFeedbackChange(previous) {
            if (getFeedback() !== feedback) return
            if (
              previous.touched !== feedback.touched ||
              previous.pending !== feedback.pending ||
              previous.validationError !== feedback.validationError ||
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
 * Use `onChange` to request a render when field state changes. Optional `validations` supplement
 * native/schema checks and can return promises. Pending checks do not delay submission; completed
 * errors block it through native validity. New submissions cancel checks and reset feedback
 * without calling `onChange`; ordinary renders preserve it.
 *
 * @param formDefinition Form definition that provides attributes, errors, and field validators.
 * @param options Current submission source, render notification, and supplemental checks (optional).
 * @returns Related form, control, label, and error mixin factories, plus live field state.
 */
export function createFormMixins<fields extends Readonly<Record<string, unknown>>, submission>(
  formDefinition: FormDefinitionSource<fields, submission>,
  options: FormMixinsOptions<submission, fields> = {},
): FormMixins<fields> {
  let bindings: Record<string, FieldMixins> = {}
  let fieldStates: Record<string, FieldState> = {}
  let errors: Record<string, ReadonlyArray<string>> = {}

  for (let field in formDefinition.fields) {
    if (!Object.hasOwn(formDefinition.fields, field)) continue
    Object.defineProperty(bindings, field, {
      enumerable: true,
      value: createFieldMixins(
        {
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
        { ...options, name: field, validations: options.validations?.[field] },
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
 * @param handler Receives a snapshot of the field name, error id, and live field state.
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

function validateInput(input: ValidatableControl, validate: FieldValidator): void {
  input.setCustomValidity('')
  if (input.validity.valid) validate(input)
}

function getControlKey(control: ValidatableControl): string {
  return JSON.stringify([
    control.value,
    control instanceof HTMLInputElement ? control.checked : undefined,
  ])
}

function isValidationPromise(
  result: ReadonlyArray<string> | Promise<ReadonlyArray<string>>,
): result is Promise<ReadonlyArray<string>> {
  return 'then' in result
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
