import { createElement, createMixin, on, ref } from '@remix-run/component'
import type { Dispatched, ElementProps } from '@remix-run/component'
import type { ErrorMap } from '@remix-run/data-schema'

import { onFormReset } from './lib/form-reset.ts'

export type ValidatableControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
export interface FieldState {
  readonly errors: ReadonlyArray<string>
  readonly touched: boolean
}
export interface FieldFeedback {
  touched: boolean
  hasServerErrors: boolean
  errors: ReadonlyArray<string>
  customErrors: ReadonlyArray<string>
  customValue?: string
  refreshControls: Set<() => void>
}
export interface FieldMixinConfig {
  attrs: Record<string, unknown>
  validate(control: ValidatableControl): void
  field: string
  errorMap?: ErrorMap
  errorId: string
  feedback: FieldFeedback
  repeated: boolean
  onFeedbackChange(previous: FieldState): void
}

const INPUT_VALIDATION_EVENT = 'rmx:input-validation' as const

declare global {
  interface HTMLElementEventMap {
    [INPUT_VALIDATION_EVENT]: InputValidationEvent
  }
}

/**
 * Presentation-ready validation state for a model-backed input.
 *
 * This experimental API may change or be removed in patch releases.
 */
export interface InputValidationState extends FieldState {
  /** The projected field name, independent of an overridden input name or id. */
  readonly field: string
  /** The generated id to apply to the application's error element. */
  readonly errorId: string
}

/**
 * A bubbling notification for rendering application-owned field errors.
 *
 * This experimental API may change or be removed in patch releases.
 */
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

export const formValidity = createMixin<HTMLFormElement, [], ElementProps>(() => () => [
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

export const fieldValidity = createMixin<
  ValidatableControl,
  [getConfig: () => FieldMixinConfig],
  ElementProps
>((handle, hostType) => {
  let previousConfig: FieldMixinConfig | undefined
  let mountedControl: ValidatableControl | undefined
  let resetControl: (control: ValidatableControl) => void
  let refreshControl: (() => void) | undefined

  handle.addEventListener('insert', (event) => {
    mountedControl = event.node
    handle.queueTask(() => {
      if (!previousConfig || mountedControl !== event.node) return
      if (previousConfig.repeated) return
      let { feedback } = previousConfig
      let key = getControlKey(event.node, previousConfig.repeated)
      if (feedback.customValue !== undefined && feedback.customValue !== key) {
        feedback.customErrors = []
      }
      feedback.customValue = key
      validateInput(event.node, previousConfig, feedback.customErrors)
    })
  })

  handle.addEventListener('remove', () => {
    mountedControl = undefined
    if (previousConfig && refreshControl)
      previousConfig.feedback.refreshControls.delete(refreshControl)
    if (previousConfig?.repeated) {
      let feedback = previousConfig.feedback
      queueMicrotask(() => {
        for (let refresh of feedback.refreshControls) refresh()
      })
    }
  })

  return (getConfig, props) => {
    let config = getConfig()
    let feedback = config.feedback
    if (previousConfig && previousConfig.feedback !== feedback) {
      handle.queueTask(() => {
        if (mountedControl && previousConfig?.feedback === feedback) {
          let nextProps = getFeedbackProps()
          if (mountedControl instanceof HTMLInputElement && mountedControl.type === 'file') {
            mountedControl.value = ''
          } else if (
            mountedControl instanceof HTMLInputElement &&
            typeof nextProps.defaultChecked === 'boolean' &&
            nextProps.checked === undefined
          ) {
            mountedControl.checked = nextProps.defaultChecked
          } else if (
            mountedControl instanceof HTMLSelectElement &&
            (Array.isArray(nextProps.defaultValue) || typeof nextProps.defaultValue === 'string') &&
            nextProps.value === undefined
          ) {
            let values = new Set(
              Array.isArray(nextProps.defaultValue)
                ? nextProps.defaultValue
                : [nextProps.defaultValue],
            )
            let matched = false
            for (let option of mountedControl.options) {
              let selected = values.has(option.value) && (mountedControl.multiple || !matched)
              option.defaultSelected = selected
              option.selected = selected
              if (selected) matched = true
            }
          } else if (typeof nextProps.defaultValue === 'string' && nextProps.value === undefined) {
            mountedControl.value = nextProps.defaultValue
          }
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
      let key = getControlKey(input, config.repeated)
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

    if (refreshControl) feedback.refreshControls.delete(refreshControl)
    refreshControl = function refresh() {
      let nextConfig = getConfig()
      config = nextConfig
      feedback = config.feedback
      previousConfig = config
      if (mountedControl) updateFeedback(mountedControl, 'custom')
    }
    feedback.refreshControls.add(refreshControl)
    resetControl = (control) => updateFeedback(control, 'reset')
    if (config.repeated || config.attrs.type === 'radio') {
      handle.queueTask(() => {
        if (mountedControl && previousConfig === config) updateFeedback(mountedControl, 'sync')
      })
    }

    return createElement(handle.element, {
      ...getFeedbackProps(),
      mix: [
        ref((control: ValidatableControl, signal) => {
          onFormReset(control, signal, () => resetControl(control))
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
 * Observes field feedback without taking ownership of its markup or disabling default behavior.
 *
 * This experimental API may change or be removed in patch releases.
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
  config: Pick<FieldMixinConfig, 'validate' | 'field' | 'errorMap' | 'repeated'>,
  customErrors: ReadonlyArray<string> = [],
): ReadonlyArray<string> {
  let controls =
    config.repeated || (input instanceof HTMLInputElement && input.type === 'radio')
      ? getGroupControls(input)
      : [input]
  let target = input.willValidate
    ? input
    : config.repeated
      ? controls.find((control) => control.willValidate)
      : undefined
  if (!target) return []
  input = target
  let previousMessage = input.validity.customError ? input.validationMessage : ''
  for (let control of controls) control.setCustomValidity('')
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
    for (let control of controls) {
      if (control !== input) control.setCustomValidity(input.validationMessage)
    }
    return errors
  } catch (error) {
    for (let control of controls)
      control.setCustomValidity(previousMessage || customErrors[0] || '')
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
  if (input instanceof HTMLInputElement && (type === 'number' || type === 'range')) {
    if (validity.rangeUnderflow) return { code: 'number.min', values: { min: Number(input.min) } }
    if (validity.rangeOverflow) return { code: 'number.max', values: { max: Number(input.max) } }
  }
}

function getControlValue(input: ValidatableControl): unknown {
  if (input instanceof HTMLInputElement) {
    if (input.type === 'radio')
      return getGroupControls(input).find(
        (control) =>
          control instanceof HTMLInputElement && control.checked && !control.matches(':disabled'),
      )?.value
    if (input.type === 'file') {
      let files = [...(input.files ?? [])]
      return input.multiple ? files : files[0]
    }
    if (input.type === 'checkbox') return input.checked
    if (input.type === 'number' || input.type === 'range') {
      if (input.validity.badInput) return NaN
      return input.value.trim() === '' ? undefined : Number(input.value)
    }
  }
  return input.value === '' ? undefined : input.value
}

function getControlKey(control: ValidatableControl, repeated: boolean): string {
  if (repeated) return JSON.stringify(getRepeatedValues(control))
  if (control instanceof HTMLInputElement && control.type === 'radio')
    return JSON.stringify([getControlValue(control)])
  if (control instanceof HTMLInputElement && control.type === 'file')
    return JSON.stringify(
      [...(control.files ?? [])].map((file) => [
        file.name,
        file.size,
        file.type,
        file.lastModified,
      ]),
    )
  return JSON.stringify([
    control.value,
    control instanceof HTMLInputElement ? control.checked : undefined,
  ])
}

export function getGroupControls(control: ValidatableControl): ValidatableControl[] {
  if (
    !(control instanceof HTMLInputElement) ||
    (control.type !== 'radio' && control.type !== 'checkbox') ||
    !control.name
  )
    return [control]
  let root = control.getRootNode()
  let elements =
    control.form?.elements ??
    (root instanceof Document || root instanceof DocumentFragment || root instanceof Element
      ? root.querySelectorAll('input')
      : [])
  return [...elements].filter(
    (node): node is HTMLInputElement =>
      node instanceof HTMLInputElement &&
      node.type === control.type &&
      node.name === control.name &&
      node.form === control.form,
  )
}

export function getRepeatedValues(control: ValidatableControl): string[] {
  if (control instanceof HTMLSelectElement)
    return [...control.selectedOptions]
      .filter((option) => !option.matches(':disabled'))
      .map((option) => option.value)
  return getGroupControls(control)
    .filter(
      (node): node is HTMLInputElement =>
        node instanceof HTMLInputElement && node.checked && !node.matches(':disabled'),
    )
    .map((node) => node.value)
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
