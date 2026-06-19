import { attrs, createElement, createMixin, on, ref } from '@remix-run/ui'
import type {
  Dispatched,
  ElementProps,
  Handle,
  MixinFactory,
  MixinHandle,
  RemixNode,
} from '@remix-run/ui'

export type CheckboxState = boolean | 'mixed'

export interface CheckboxControlOptions {
  checked?: CheckboxState
  defaultChecked?: CheckboxState
  disabled?: boolean
  form?: string
  inputRef?: (input: HTMLInputElement, signal: AbortSignal) => void
  name?: string
  onCheckedChange?: (checked: CheckboxState) => void
  readOnly?: boolean
  required?: boolean
  tabIndex?: number
  value?: string
}

export interface CheckboxGroupContextProps {
  children?: RemixNode
  defaultValue?: string[]
  disabled?: boolean
  name?: string
  onValueChange?: (value: string[]) => void
  value?: string[]
}

export interface CheckboxParentOptions {
  disabled?: boolean
  form?: string
  inputRef?: (input: HTMLInputElement, signal: AbortSignal) => void
  readOnly?: boolean
  required?: boolean
  tabIndex?: number
}

export interface CheckboxItemOptions {
  disabled?: boolean
  form?: string
  inputId?: string
  inputRef?: (input: HTMLInputElement, signal: AbortSignal) => void
  name?: string
  readOnly?: boolean
  required?: boolean
  tabIndex?: number
  value: string
}

export interface CheckboxGroupChangeEventInit {
  changedValue: string | null
  value: string[]
}

type CheckboxChangeHandler<target extends HTMLElement> = (
  event: Dispatched<CheckboxChangeEvent, target>,
  signal: AbortSignal,
) => void | Promise<void>

type CheckboxGroupChangeHandler<target extends HTMLElement> = (
  event: Dispatched<CheckboxGroupChangeEvent, target>,
  signal: AbortSignal,
) => void | Promise<void>

const CHECKBOX_CHANGE_EVENT = 'rmx:checkbox-change' as const
const CHECKBOX_GROUP_CHANGE_EVENT = 'rmx:checkbox-group-change' as const

declare global {
  interface HTMLElementEventMap {
    [CHECKBOX_CHANGE_EVENT]: CheckboxChangeEvent
    [CHECKBOX_GROUP_CHANGE_EVENT]: CheckboxGroupChangeEvent
  }
}

export class CheckboxChangeEvent extends Event {
  readonly checked: CheckboxState

  constructor(checked: CheckboxState) {
    super(CHECKBOX_CHANGE_EVENT, { bubbles: true })
    this.checked = checked
  }
}

export class CheckboxGroupChangeEvent extends Event {
  readonly changedValue: string | null
  readonly value: string[]

  constructor(init: CheckboxGroupChangeEventInit) {
    super(CHECKBOX_GROUP_CHANGE_EVENT, { bubbles: true })
    this.changedValue = init.changedValue
    this.value = init.value
  }
}

interface RegisteredCheckboxItem {
  disabled: boolean
  value: string
}

interface CheckboxGroupContextValue {
  readonly disabled: boolean
  readonly name: string | undefined
  getItemChecked(value: string): boolean
  getParentChecked(): CheckboxState
  registerItem(item: RegisteredCheckboxItem): void
  registerRoot(node: HTMLElement): void
  setItemChecked(value: string, checked: CheckboxState): void
  setParentChecked(checked: CheckboxState): void
  unregisterRoot(node: HTMLElement): void
}

function isMixed(checked: CheckboxState): boolean {
  return checked === 'mixed'
}

function isChecked(checked: CheckboxState): boolean {
  return checked === true
}

function getNextChecked(checked: CheckboxState): boolean {
  return checked === true ? false : true
}

function getCheckboxState(value: unknown): CheckboxState | undefined {
  return value === true || value === false || value === 'mixed' ? value : undefined
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

function arraysEqual(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) {
    return false
  }

  return left.every((value, index) => value === right[index])
}

function uniqueValues(values: readonly string[]) {
  return Array.from(new Set(values))
}

function getCheckboxGroupContext(handle: Handle<unknown, unknown> | MixinHandle) {
  return handle.context.get(CheckboxGroupProvider)
}

function getNextGroupChecked(checked: CheckboxState): boolean {
  return checked === true ? false : true
}

function CheckboxGroupProvider(
  handle: Handle<CheckboxGroupContextProps, CheckboxGroupContextValue>,
): () => RemixNode {
  let registeredItems: RegisteredCheckboxItem[] = []
  let nextRegisteredItems: RegisteredCheckboxItem[] = []
  let root: HTMLElement | null = null
  let uncontrolledValue: string[] = []
  let hasInitialized = false

  function registeredItemsChanged() {
    if (registeredItems.length !== nextRegisteredItems.length) {
      return true
    }

    return nextRegisteredItems.some((item, index) => {
      let currentItem = registeredItems[index]
      return currentItem?.disabled !== item.disabled || currentItem.value !== item.value
    })
  }

  function getValue() {
    if (handle.props.value !== undefined) {
      return handle.props.value
    }

    if (!hasInitialized) {
      uncontrolledValue = uniqueValues(handle.props.defaultValue ?? [])
      hasInitialized = true
    }

    return uncontrolledValue
  }

  function getEnabledValues() {
    let items = nextRegisteredItems.length > 0 ? nextRegisteredItems : registeredItems
    return items.filter((item) => !item.disabled).map((item) => item.value)
  }

  function getParentChecked(): CheckboxState {
    let values = getValue()
    let enabledValues = getEnabledValues()

    if (enabledValues.length === 0) {
      return false
    }

    let selectedCount = enabledValues.filter((value) => values.includes(value)).length
    if (selectedCount === 0) {
      return false
    }

    return selectedCount === enabledValues.length ? true : 'mixed'
  }

  function setValue(nextValue: string[], changedValue: string | null) {
    let value = uniqueValues(nextValue)
    if (arraysEqual(value, getValue())) {
      return
    }

    if (handle.props.value === undefined) {
      uncontrolledValue = value
      void handle.update()
    }

    handle.props.onValueChange?.(value)
    root?.dispatchEvent(new CheckboxGroupChangeEvent({ changedValue, value }))
  }

  function setItemChecked(value: string, checked: CheckboxState) {
    if (handle.props.disabled) {
      return
    }

    let currentValue = getValue()
    let nextChecked = isChecked(checked)
    let itemIsChecked = currentValue.includes(value)

    if (nextChecked === itemIsChecked) {
      return
    }

    setValue(
      nextChecked
        ? [...currentValue, value]
        : currentValue.filter((currentValue) => currentValue !== value),
      value,
    )
  }

  function setParentChecked(checked: CheckboxState) {
    if (handle.props.disabled) {
      return
    }

    let currentValue = getValue()
    let enabledValues = getEnabledValues()
    let shouldSelectAll = checked === true

    setValue(
      shouldSelectAll
        ? uniqueValues([...currentValue, ...enabledValues])
        : currentValue.filter((value) => !enabledValues.includes(value)),
      null,
    )
  }

  handle.context.set({
    get disabled() {
      return handle.props.disabled ?? false
    },
    get name() {
      return handle.props.name
    },
    getItemChecked(value) {
      return getValue().includes(value)
    },
    getParentChecked,
    registerItem(item) {
      nextRegisteredItems.push(item)
    },
    registerRoot(node) {
      root = node
    },
    setItemChecked,
    setParentChecked,
    unregisterRoot(node) {
      if (root === node) {
        root = null
      }
    },
  })

  return () => {
    nextRegisteredItems = []

    handle.queueTask(() => {
      if (!registeredItemsChanged()) {
        return
      }

      registeredItems = nextRegisteredItems
      void handle.update()
    })

    return handle.props.children
  }
}

const controlMixin: MixinFactory<HTMLElement, [options?: CheckboxControlOptions], ElementProps> =
  createMixin<HTMLElement, [options?: CheckboxControlOptions], ElementProps>((handle, hostType) => {
    let uncontrolledChecked: CheckboxState = false
    let hasInitialized = false

    function getChecked(options: CheckboxControlOptions, props: ElementProps) {
      let optionChecked = getCheckboxState(options.checked)
      if (optionChecked !== undefined) {
        return optionChecked
      }

      let propChecked = getCheckboxState(props.checked)
      if (propChecked !== undefined) {
        return propChecked
      }

      if (!hasInitialized) {
        uncontrolledChecked =
          getCheckboxState(options.defaultChecked) ??
          getCheckboxState(props.defaultChecked) ??
          false
        hasInitialized = true
      }

      return uncontrolledChecked
    }

    function setChecked(
      node: HTMLElement,
      options: CheckboxControlOptions,
      props: ElementProps,
      nextChecked: CheckboxState,
    ) {
      if (isDisabled(options, props) || isReadOnly(options, props)) {
        syncInput(node, getChecked(options, props))
        return
      }

      if (options.checked === undefined && props.checked === undefined) {
        uncontrolledChecked = nextChecked
        void handle.update()
      }

      options.onCheckedChange?.(nextChecked)
      node.dispatchEvent(new CheckboxChangeEvent(nextChecked))
    }

    function syncInput(node: HTMLElement, checked: CheckboxState) {
      if (node instanceof HTMLInputElement) {
        node.indeterminate = isMixed(checked)
      }
    }

    return (options = {}, props) => {
      let checked = getChecked(options, props)
      let checkedValue = isChecked(checked)
      let mixed = isMixed(checked)
      let disabled = isDisabled(options, props)
      let readOnly = isReadOnly(options, props)
      let required = options.required ?? props.required

      handle.queueTask((node) => {
        syncInput(node, checked)
      })

      let nextProps: ElementProps = {
        ...props,
        'aria-checked': mixed ? 'mixed' : checkedValue,
        'aria-disabled': disabled || undefined,
        'aria-readonly': readOnly || undefined,
        'aria-required': required || undefined,
        checked: hostType === 'input' ? checkedValue : props.checked,
        defaultChecked: hostType === 'input' ? undefined : props.defaultChecked,
        disabled: hostType === 'input' ? disabled || undefined : props.disabled,
        form: hostType === 'input' ? (options.form ?? props.form) : props.form,
        name: hostType === 'input' ? (options.name ?? props.name) : props.name,
        readOnly: hostType === 'input' ? readOnly || undefined : props.readOnly,
        required: hostType === 'input' ? required : props.required,
        role: hostType === 'input' ? props.role : 'checkbox',
        tabIndex:
          hostType === 'input'
            ? (options.tabIndex ?? props.tabIndex)
            : disabled
              ? undefined
              : (options.tabIndex ?? props.tabIndex ?? 0),
        type: hostType === 'input' && props.type === undefined ? 'checkbox' : props.type,
        value: hostType === 'input' ? (options.value ?? props.value) : props.value,
        'data-state': mixed ? 'mixed' : checkedValue ? 'checked' : 'unchecked',
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
              syncInput(event.currentTarget, checked)
              if (event.currentTarget instanceof HTMLInputElement) {
                event.currentTarget.checked = checkedValue
              }
              return
            }

            let nextChecked =
              event.currentTarget instanceof HTMLInputElement
                ? event.currentTarget.checked
                : getNextChecked(checked)

            setChecked(event.currentTarget, options, props, nextChecked)
          }),
          on<HTMLElement, 'keydown'>('keydown', (event) => {
            if (hostType === 'input' || event.key !== ' ') {
              return
            }

            event.preventDefault()
            setChecked(event.currentTarget, options, props, getNextChecked(checked))
          }),
        ],
      })
    }
  })

const parentMixin: MixinFactory<HTMLElement, [options?: CheckboxParentOptions], ElementProps> =
  createMixin<HTMLElement, [options?: CheckboxParentOptions], ElementProps>((handle, hostType) => {
    let context = getCheckboxGroupContext(handle)

    function syncInput(node: HTMLElement, checked: CheckboxState) {
      if (node instanceof HTMLInputElement) {
        node.indeterminate = isMixed(checked)
      }
    }

    return (options = {}, props) => {
      let checked = context.getParentChecked()
      let disabled = options.disabled === true || context.disabled || isDisabled(options, props)
      let readOnly = isReadOnly(options, props)
      let required = options.required ?? props.required
      let checkedValue = isChecked(checked)
      let mixed = isMixed(checked)

      handle.queueTask((node) => {
        syncInput(node, checked)
      })

      let nextProps: ElementProps = {
        ...props,
        'aria-checked': mixed ? 'mixed' : checkedValue,
        'aria-disabled': disabled || undefined,
        'aria-readonly': readOnly || undefined,
        'aria-required': required || undefined,
        checked: hostType === 'input' ? checkedValue : props.checked,
        defaultChecked: hostType === 'input' ? undefined : props.defaultChecked,
        disabled: hostType === 'input' ? disabled || undefined : props.disabled,
        form: hostType === 'input' ? (options.form ?? props.form) : props.form,
        readOnly: hostType === 'input' ? readOnly || undefined : props.readOnly,
        required: hostType === 'input' ? required : props.required,
        role: hostType === 'input' ? props.role : 'checkbox',
        tabIndex:
          hostType === 'input'
            ? (options.tabIndex ?? props.tabIndex)
            : disabled
              ? undefined
              : (options.tabIndex ?? props.tabIndex ?? 0),
        type: hostType === 'input' && props.type === undefined ? 'checkbox' : props.type,
        'data-state': mixed ? 'mixed' : checkedValue ? 'checked' : 'unchecked',
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
            event.preventDefault()

            if (disabled || readOnly) {
              syncInput(event.currentTarget, checked)
              return
            }

            context.setParentChecked(getNextGroupChecked(checked))
          }),
          on<HTMLElement, 'keydown'>('keydown', (event) => {
            if (hostType === 'input' || event.key !== ' ') {
              return
            }

            event.preventDefault()
            if (!disabled && !readOnly) {
              context.setParentChecked(getNextGroupChecked(checked))
            }
          }),
        ],
      })
    }
  })

const itemMixin: MixinFactory<HTMLElement, [options: CheckboxItemOptions], ElementProps> =
  createMixin<HTMLElement, [options: CheckboxItemOptions], ElementProps>((handle, hostType) => {
    let context = getCheckboxGroupContext(handle)

    return (options, props) => {
      let disabled = options.disabled === true || context.disabled || isDisabled(options, props)
      let checkedValue = context.getItemChecked(options.value)
      let readOnly = isReadOnly(options, props)
      let required = options.required ?? props.required

      context.registerItem({ disabled, value: options.value })

      let nextProps: ElementProps = {
        ...props,
        'aria-checked': checkedValue,
        'aria-disabled': disabled || undefined,
        'aria-readonly': readOnly || undefined,
        'aria-required': required || undefined,
        checked: hostType === 'input' ? checkedValue : props.checked,
        defaultChecked: hostType === 'input' ? undefined : props.defaultChecked,
        disabled: hostType === 'input' ? disabled || undefined : props.disabled,
        form: hostType === 'input' ? (options.form ?? props.form) : props.form,
        id: hostType === 'input' ? (options.inputId ?? props.id) : props.id,
        name: hostType === 'input' ? (options.name ?? props.name ?? context.name) : props.name,
        readOnly: hostType === 'input' ? readOnly || undefined : props.readOnly,
        required: hostType === 'input' ? required : props.required,
        role: hostType === 'input' ? props.role : 'checkbox',
        tabIndex:
          hostType === 'input'
            ? (options.tabIndex ?? props.tabIndex)
            : disabled
              ? undefined
              : (options.tabIndex ?? props.tabIndex ?? 0),
        type: hostType === 'input' && props.type === undefined ? 'checkbox' : props.type,
        value: hostType === 'input' ? options.value : props.value,
        'data-state': checkedValue ? 'checked' : 'unchecked',
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
                event.currentTarget.checked = checkedValue
              }
              return
            }

            let nextChecked =
              event.currentTarget instanceof HTMLInputElement
                ? event.currentTarget.checked
                : !checkedValue

            context.setItemChecked(options.value, nextChecked)
          }),
          on<HTMLElement, 'keydown'>('keydown', (event) => {
            if (hostType === 'input' || event.key !== ' ') {
              return
            }

            event.preventDefault()
            if (!disabled && !readOnly) {
              context.setItemChecked(options.value, !checkedValue)
            }
          }),
        ],
      })
    }
  })

const groupMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let context = getCheckboxGroupContext(handle)

  return () => [
    attrs({
      'aria-disabled': context.disabled || undefined,
      role: 'group',
    }),
    ref((node: HTMLElement, signal) => {
      context.registerRoot(node)
      signal.addEventListener('abort', () => {
        context.unregisterRoot(node)
      })
    }),
  ]
})

export const GroupContext = CheckboxGroupProvider
export const control = controlMixin
export const group = groupMixin
export const item = itemMixin
export const parent = parentMixin

export function onCheckboxChange<target extends HTMLElement>(
  handler: CheckboxChangeHandler<target>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof CHECKBOX_CHANGE_EVENT>> {
  return on(CHECKBOX_CHANGE_EVENT, handler, captureBoolean)
}

export function onCheckboxGroupChange<target extends HTMLElement>(
  handler: CheckboxGroupChangeHandler<target>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof CHECKBOX_GROUP_CHANGE_EVENT>> {
  return on(CHECKBOX_GROUP_CHANGE_EVENT, handler, captureBoolean)
}
