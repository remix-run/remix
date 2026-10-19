import { attrs, createElement, createMixin, on } from '@remix-run/component'
import type { Dispatched, ElementProps, MixinDescriptor } from '@remix-run/component'

type ValidatableControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
type FormMixin = MixinDescriptor<HTMLFormElement, [], ElementProps>
type InputValidator = (input: HTMLInputElement) => void
type InputMixin = MixinDescriptor<
  HTMLInputElement,
  [getConfig: () => InputMixinConfig],
  ElementProps
>

interface InputMixinConfig {
  attrs: object
  validate: InputValidator
  field: string
  errorId: string
  feedback: InputFeedback
  onFeedbackChange(previousErrors: ReadonlyArray<string>): void
}

interface InputFeedback {
  touched: boolean
  hasServerErrors: boolean
  errors: ReadonlyArray<string>
}

interface InputFormDefinition<fields extends Readonly<Record<string, unknown>>, submission> {
  readonly fields: fields
  getInputAttrs<field extends keyof fields & string>(field: field, submission?: submission): object
  createInputValidator<field extends keyof fields & string>(field: field): InputValidator
  getErrorAttrs<field extends keyof fields & string>(field: field): { id: string }
  getFieldErrors<field extends keyof fields & string>(
    field: field,
    submission?: submission,
  ): ReadonlyArray<string>
}

/** Dynamic submission data for setup-scoped form mixins. */
export interface FormMixinsOptions<submission> {
  /** Reads the current submission when rendering mixins or reading errors; does not subscribe. */
  getSubmission?: () => submission | undefined
  /** Requests application rendering when visible client error messages change. */
  onChange?: () => void
}

/** Related validation mixins bound to one form definition. */
export interface FormMixins<fields extends Readonly<Record<string, unknown>>> {
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
  input<field extends keyof fields & string>(field: field): InputMixin
  /**
   * Applies the generated error-element id without controlling content, visibility, or role.
   *
   * @param field The projected field name.
   * @returns An attribute-only mixin for application-owned error markup.
   */
  error<field extends keyof fields & string>(field: field): ReturnType<typeof attrs>
}

const INPUT_VALIDATION_EVENT = 'rmx:input-validation' as const

declare global {
  interface HTMLElementEventMap {
    [INPUT_VALIDATION_EVENT]: InputValidationEvent
  }
}

/** Presentation-ready validation state for a model-backed input. */
export interface InputValidationState {
  /** The projected field name, independent of an overridden input name or id. */
  readonly field: string
  /** The generated id to apply to the application's error element. */
  readonly errorId: string
  /** Visible errors, empty until blur or an invalid submission unless the server returned errors. */
  readonly errors: ReadonlyArray<string>
  /** Whether client feedback is revealed after blur, invalid submission, or editing a server error. */
  readonly touched: boolean
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

const inputValidity = createMixin<
  HTMLInputElement,
  [getConfig: () => InputMixinConfig],
  ElementProps
>((handle) => {
  let previousConfig: InputMixinConfig | undefined

  handle.addEventListener('insert', (event) => {
    if (previousConfig) validateInput(event.node, previousConfig.validate)
  })

  return (getConfig, props) => {
    let config = getConfig()
    let feedback = config.feedback
    previousConfig = config

    function getFeedbackProps(): ElementProps {
      let { touched, hasServerErrors, errors } = feedback
      let attrs: ElementProps = { ...config.attrs, ...props }
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

    function updateFeedback(input: HTMLInputElement, reason: 'input' | 'focusout' | 'invalid') {
      validateInput(input, config.validate)
      let previousErrors = feedback.errors

      if (reason === 'input') {
        feedback.touched ||= feedback.hasServerErrors
        feedback.hasServerErrors = false
      } else {
        feedback.touched = true
      }

      if (!feedback.hasServerErrors) {
        feedback.errors =
          feedback.touched && input.validationMessage ? [input.validationMessage] : []
      }

      let props = getFeedbackProps()
      setAttribute(input, 'aria-invalid', props['aria-invalid'])
      setAttribute(input, 'aria-describedby', props['aria-describedby'])
      input.toggleAttribute('data-touched', feedback.touched)
      if (!feedback.hasServerErrors) input.removeAttribute('data-form-error-id')

      config.onFeedbackChange(previousErrors)

      input.dispatchEvent(
        new InputValidationEvent({
          field: config.field,
          errorId: config.errorId,
          errors: feedback.errors,
          touched: feedback.touched,
        }),
      )
    }

    return createElement(handle.element, {
      ...getFeedbackProps(),
      mix: [
        on<HTMLInputElement>('input', (event) => updateFeedback(event.currentTarget, 'input')),
        on<HTMLInputElement>('focusout', (event) =>
          updateFeedback(event.currentTarget, 'focusout'),
        ),
        on<HTMLInputElement>('invalid', (event) => updateFeedback(event.currentTarget, 'invalid')),
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
 * Binds form and input validation mixins to a model-backed form definition.
 *
 * Applies native constraints and restored server values during SSR. In the browser, it validates
 * on input, reveals feedback after blur or an invalid submission, and owns error accessibility.
 * Render the live `errors` arrays in application-owned markup and apply `error(field)` to link it.
 * Explicit host props override generated attributes; error ids are appended to `aria-describedby`.
 * Create the binding in component setup and use `getSubmission` to read changing submission props.
 * The getter is evaluated while reading errors or rendering inputs, including SSR, not on binding.
 * Use `onChange` to request a render when visible client errors change. New submissions reset
 * feedback without calling `onChange`; ordinary renders preserve it.
 *
 * @param formDefinition Form definition that provides attributes, errors, and field validators.
 * @param options Current submission source and render notification (optional).
 * @returns Related form, input, and error mixin factories, plus live visible field errors.
 */
export function createFormMixins<fields extends Readonly<Record<string, unknown>>, submission>(
  formDefinition: InputFormDefinition<fields, submission>,
  options: FormMixinsOptions<submission> = {},
): FormMixins<fields> {
  let previousSubmission: submission | undefined
  let feedbackByField = new Map<keyof fields & string, InputFeedback>()
  let errors: Record<string, ReadonlyArray<string>> = {}

  function getSubmission(): submission | undefined {
    let submission = options.getSubmission?.()
    if (submission !== previousSubmission) {
      feedbackByField.clear()
      previousSubmission = submission
    }
    return submission
  }

  function getFeedback(field: keyof fields & string): InputFeedback {
    let submission = getSubmission()
    let feedback = feedbackByField.get(field)
    if (!feedback) {
      let errors = formDefinition.getFieldErrors(field, submission)
      feedback = { touched: false, hasServerErrors: errors.length > 0, errors }
      feedbackByField.set(field, feedback)
    }
    return feedback
  }

  for (let field in formDefinition.fields) {
    if (!Object.hasOwn(formDefinition.fields, field)) continue
    Object.defineProperty(errors, field, {
      enumerable: true,
      get() {
        return getFeedback(field).errors
      },
    })
  }

  return {
    // Every own projected field has a live getter installed above.
    errors: Object.freeze(errors) as FormMixins<fields>['errors'],
    form() {
      return formValidity()
    },
    input(field) {
      return inputValidity(() => {
        let submission = getSubmission()
        let feedback = getFeedback(field)
        return {
          attrs: formDefinition.getInputAttrs(field, submission),
          validate: formDefinition.createInputValidator(field),
          field,
          errorId: formDefinition.getErrorAttrs(field).id,
          feedback,
          onFeedbackChange(previousErrors) {
            if (getFeedback(field) !== feedback) return
            if (
              previousErrors.length !== feedback.errors.length ||
              previousErrors.some((message, index) => message !== feedback.errors[index])
            ) {
              options.onChange?.()
            }
          },
        }
      })
    },
    error(field) {
      return attrs(formDefinition.getErrorAttrs(field))
    },
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

function validateInput(input: HTMLInputElement, validate: InputValidator): void {
  input.setCustomValidity('')
  if (input.validity.valid) validate(input)
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
