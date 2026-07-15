import { createElement, createMixin, on, ref } from '@remix-run/ui'
import type { Dispatched, ElementProps, MixinFactory } from '@remix-run/ui'

export interface ToggleControlOptions {
  checked?: boolean
  defaultChecked?: boolean
  disabled?: boolean
  form?: string
  inputRef?: (input: HTMLInputElement, signal: AbortSignal) => void
  name?: string
  onCheckedChange?: (checked: boolean) => void
  readOnly?: boolean
  required?: boolean
  tabIndex?: number
  value?: string
}

type ToggleChangeHandler<target extends HTMLElement> = (
  event: Dispatched<ToggleChangeEvent, target>,
  signal: AbortSignal,
) => void | Promise<void>

const TOGGLE_CHANGE_EVENT = 'rmx:toggle-change' as const

declare global {
  interface HTMLElementEventMap {
    [TOGGLE_CHANGE_EVENT]: ToggleChangeEvent
  }
}

export class ToggleChangeEvent extends Event {
  readonly checked: boolean

  constructor(checked: boolean) {
    super(TOGGLE_CHANGE_EVENT, { bubbles: true })
    this.checked = checked
  }
}

function getBooleanState(value: unknown): boolean | undefined {
  return value === true || value === false ? value : undefined
}

function propIsTrue(value: unknown): boolean {
  return value === true || value === 'true' || value === ''
}

function isDisabled(options: { disabled?: boolean }, props: ElementProps): boolean {
  return (
    options.disabled === true || propIsTrue(props.disabled) || propIsTrue(props['aria-disabled'])
  )
}

function isReadOnly(options: { readOnly?: boolean }, props: ElementProps): boolean {
  return (
    options.readOnly === true || propIsTrue(props.readOnly) || propIsTrue(props['aria-readonly'])
  )
}

const controlMixin: MixinFactory<HTMLElement, [options?: ToggleControlOptions], ElementProps> =
  createMixin<HTMLElement, [options?: ToggleControlOptions], ElementProps>((handle, hostType) => {
    let uncontrolledChecked = false
    let hasInitialized = false

    function getChecked(options: ToggleControlOptions, props: ElementProps) {
      let optionChecked = getBooleanState(options.checked)
      if (optionChecked !== undefined) {
        return optionChecked
      }

      let propChecked = getBooleanState(props.checked)
      if (propChecked !== undefined) {
        return propChecked
      }

      if (!hasInitialized) {
        uncontrolledChecked =
          getBooleanState(options.defaultChecked) ?? getBooleanState(props.defaultChecked) ?? false
        hasInitialized = true
      }

      return uncontrolledChecked
    }

    function setChecked(
      node: HTMLElement,
      options: ToggleControlOptions,
      props: ElementProps,
      nextChecked: boolean,
    ) {
      if (isDisabled(options, props) || isReadOnly(options, props)) {
        if (node instanceof HTMLInputElement) {
          node.checked = getChecked(options, props)
        }
        return
      }

      if (options.checked === undefined && props.checked === undefined) {
        uncontrolledChecked = nextChecked
        void handle.update()
      }

      options.onCheckedChange?.(nextChecked)
      node.dispatchEvent(new ToggleChangeEvent(nextChecked))
    }

    return (options = {}, props) => {
      let checked = getChecked(options, props)
      let disabled = isDisabled(options, props)
      let readOnly = isReadOnly(options, props)
      let required = options.required ?? props.required

      let nextProps: ElementProps = {
        ...props,
        'aria-checked': hostType === 'input' ? undefined : checked,
        'aria-disabled': hostType === 'input' ? undefined : disabled || undefined,
        'aria-readonly': hostType === 'input' ? undefined : readOnly || undefined,
        'aria-required': hostType === 'input' ? undefined : required || undefined,
        checked: hostType === 'input' ? checked : props.checked,
        defaultChecked: hostType === 'input' ? undefined : props.defaultChecked,
        disabled: hostType === 'input' ? disabled || undefined : props.disabled,
        form: hostType === 'input' ? (options.form ?? props.form) : props.form,
        name: hostType === 'input' ? (options.name ?? props.name) : props.name,
        readOnly: hostType === 'input' ? readOnly || undefined : props.readOnly,
        required: hostType === 'input' ? required : props.required,
        role: 'switch',
        tabIndex:
          hostType === 'input'
            ? (options.tabIndex ?? props.tabIndex)
            : disabled
              ? undefined
              : (options.tabIndex ?? props.tabIndex ?? 0),
        type:
          hostType === 'input'
            ? props.type === undefined
              ? 'checkbox'
              : props.type
            : hostType === 'button' && props.type === undefined
              ? 'button'
              : props.type,
        value: hostType === 'input' ? (options.value ?? props.value) : props.value,
        'data-state': checked ? 'checked' : 'unchecked',
      }

      return createElement(handle.element, {
        ...nextProps,
        mix: [
          ref((node: HTMLElement, signal) => {
            if (node instanceof HTMLInputElement) {
              options.inputRef?.(node, signal)
            }
          }),
          on<HTMLElement, 'click'>('click', (event) => {
            if (hostType !== 'input') {
              event.preventDefault()
            }

            if (disabled || readOnly) {
              if (event.currentTarget instanceof HTMLInputElement) {
                event.currentTarget.checked = checked
              }
              return
            }

            let nextChecked =
              event.currentTarget instanceof HTMLInputElement
                ? event.currentTarget.checked
                : !checked

            setChecked(event.currentTarget, options, props, nextChecked)
          }),
          on<HTMLElement, 'keydown'>('keydown', (event) => {
            if (hostType === 'input' || event.key !== ' ') {
              return
            }

            event.preventDefault()
            setChecked(event.currentTarget, options, props, !checked)
          }),
        ],
      })
    }
  })

export const control = controlMixin

export function onToggleChange<target extends HTMLElement>(
  handler: ToggleChangeHandler<target>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof TOGGLE_CHANGE_EVENT>> {
  return on(TOGGLE_CHANGE_EVENT, handler, captureBoolean)
}
