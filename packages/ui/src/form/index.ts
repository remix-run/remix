import { createElement, createMixin, on } from '@remix-run/ui'
import type { ElementProps, MixinDescriptor } from '@remix-run/ui'

type ValidatableControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
type FormMixin = MixinDescriptor<HTMLFormElement, [], ElementProps>
type InputValidator = (input: HTMLInputElement) => void
type InputMixin = MixinDescriptor<
  HTMLInputElement,
  [attrs: object, validate: InputValidator],
  ElementProps
>

interface InputFormDefinition<fields extends Readonly<Record<string, unknown>>, submission> {
  readonly fields: fields
  getInputAttrs<field extends keyof fields & string>(field: field, submission?: submission): object
  createInputValidator<field extends keyof fields & string>(field: field): InputValidator
}

const formValidity = createMixin<HTMLFormElement, [], ElementProps>(() => () => [
  on<HTMLFormElement>('focusout', (event) => {
    let control = getValidatableControl(event.target)

    if (control) {
      control.setAttribute('data-touched', '')
      syncValidity(control)
    }
  }),
  on<HTMLFormElement>('input', (event) => {
    let control = getValidatableControl(event.target)

    if (!control) {
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

      if (control) {
        control.setAttribute('data-touched', '')
        syncValidity(control)
      }
    },
    true,
  ),
])

const inputValidity = createMixin<
  HTMLInputElement,
  [attrs: object, validate: InputValidator],
  ElementProps
>(
  (handle) => (attrs, validate, props) =>
    createElement(handle.element, {
      ...attrs,
      ...props,
      mix: on<HTMLInputElement>('input', (event) => validate(event.currentTarget)),
    }),
)

/**
 * Creates a field-aware input mixin factory from a form definition.
 *
 * Each resulting mixin applies the form's generated attributes during server rendering and runs
 * its synchronous field validator as the input changes. Explicit host props override generated
 * attributes.
 *
 * @param formDefinition Form definition that provides input attributes and field validators.
 * @returns A mixin factory for the form's input fields.
 */
export function createInputMixin<fields extends Readonly<Record<string, unknown>>, submission>(
  formDefinition: InputFormDefinition<fields, submission>,
): <field extends keyof fields & string>(field: field, submission?: submission) => InputMixin {
  return (field, submission) =>
    inputValidity(
      formDefinition.getInputAttrs(field, submission),
      formDefinition.createInputValidator(field),
    )
}

/**
 * Enhances native form validation with touched state and accessible invalid attributes.
 *
 * Native constraint validation still prevents invalid submissions. This mixin marks a control
 * after its first blur, updates `aria-invalid` as it changes, and clears stale server error state
 * after the user edits that control.
 *
 * @returns A mixin for a native `form` element.
 */
export function form(): FormMixin {
  return formValidity()
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
