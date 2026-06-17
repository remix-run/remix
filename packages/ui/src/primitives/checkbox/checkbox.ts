import { attrs, createElement, createMixin, on, ref } from '@remix-run/ui'
import type {
  Dispatched,
  ElementProps,
  Handle,
  MixinFactory,
  MixinHandle,
  Props,
  RemixNode,
} from '@remix-run/ui'

export type CheckboxState = boolean | 'mixed'

export interface CheckboxContextProps {
  checked?: CheckboxState
  children?: RemixNode
  defaultChecked?: CheckboxState
  disabled?: boolean
  form?: string
  inputId?: string
  inputRef?: (input: HTMLInputElement, signal: AbortSignal) => void
  name?: string
  onCheckedChange?: (checked: CheckboxState) => void
  readOnly?: boolean
  required?: boolean
  tabIndex?: number
  uncheckedValue?: string
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

export interface CheckboxParentContextProps
  extends Omit<
    CheckboxContextProps,
    | 'checked'
    | 'defaultChecked'
    | 'inputId'
    | 'name'
    | 'onCheckedChange'
    | 'uncheckedValue'
    | 'value'
  > {}

export interface CheckboxItemContextProps
  extends Omit<CheckboxContextProps, 'checked' | 'defaultChecked' | 'onCheckedChange'> {
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

interface CheckboxContextValue {
  readonly checked: CheckboxState
  readonly checkedValue: boolean
  readonly disabled: boolean
  readonly form: string | undefined
  readonly inputId: string
  readonly mixed: boolean
  readonly name: string | undefined
  readonly readOnly: boolean
  readonly required: boolean | undefined
  readonly tabIndex: number | undefined
  readonly uncheckedValue: string | undefined
  readonly value: string
  setChecked(checked: CheckboxState): void
  setInput(input: HTMLInputElement | null, signal?: AbortSignal): void
  toggleChecked(): void
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

function arraysEqual(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) {
    return false
  }

  return left.every((value, index) => value === right[index])
}

function uniqueValues(values: readonly string[]) {
  return Array.from(new Set(values))
}

function getCheckboxContext(handle: Handle<unknown, unknown> | MixinHandle) {
  return handle.context.get(CheckboxProvider)
}

function getCheckboxGroupContext(handle: Handle<unknown, unknown> | MixinHandle) {
  return handle.context.get(CheckboxGroupProvider)
}

function CheckboxProvider(
  handle: Handle<CheckboxContextProps, CheckboxContextValue>,
): () => RemixNode {
  let uncontrolledChecked: CheckboxState = false
  let hasInitialized = false
  let input: HTMLInputElement | null = null

  function getChecked() {
    if (handle.props.checked !== undefined) {
      return handle.props.checked
    }

    if (!hasInitialized) {
      uncontrolledChecked = handle.props.defaultChecked ?? false
      hasInitialized = true
    }

    return uncontrolledChecked
  }

  function setChecked(nextChecked: CheckboxState) {
    if (handle.props.disabled || handle.props.readOnly) {
      return
    }

    if (handle.props.checked === undefined) {
      uncontrolledChecked = nextChecked
      void handle.update()
    }

    handle.props.onCheckedChange?.(nextChecked)
    input?.dispatchEvent(new CheckboxChangeEvent(nextChecked))
  }

  function syncInputIndeterminate() {
    if (input) {
      input.indeterminate = isMixed(getChecked())
    }
  }

  handle.context.set({
    get checked() {
      return getChecked()
    },
    get checkedValue() {
      return isChecked(getChecked())
    },
    get disabled() {
      return handle.props.disabled ?? false
    },
    get form() {
      return handle.props.form
    },
    get inputId() {
      return handle.props.inputId ?? `${handle.id}-input`
    },
    get mixed() {
      return isMixed(getChecked())
    },
    get name() {
      return handle.props.name
    },
    get readOnly() {
      return handle.props.readOnly ?? false
    },
    get required() {
      return handle.props.required
    },
    get tabIndex() {
      return handle.props.tabIndex
    },
    get uncheckedValue() {
      return handle.props.uncheckedValue
    },
    get value() {
      return handle.props.value ?? 'on'
    },
    setChecked,
    setInput(node, signal) {
      input = node
      syncInputIndeterminate()
      if (node) {
        handle.props.inputRef?.(node, signal ?? handle.signal)
      }
    },
    toggleChecked() {
      setChecked(getNextChecked(getChecked()))
    },
  })

  return () => {
    handle.queueTask(syncInputIndeterminate)
    return handle.props.children
  }
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
    return registeredItems.filter((item) => !item.disabled).map((item) => item.value)
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

function CheckboxParentProvider(handle: Handle<CheckboxParentContextProps>): () => RemixNode {
  return () => {
    let context = getCheckboxGroupContext(handle)
    let { children, disabled, readOnly, ...checkboxProps } = handle.props

    return createElement(
      CheckboxProvider,
      {
        ...checkboxProps,
        checked: context.getParentChecked(),
        disabled: disabled || context.disabled,
        onCheckedChange(nextChecked: CheckboxState) {
          context.setParentChecked(nextChecked)
        },
        readOnly,
      },
      children,
    )
  }
}

function CheckboxItemProvider(handle: Handle<CheckboxItemContextProps>): () => RemixNode {
  return () => {
    let context = getCheckboxGroupContext(handle)
    let { children, disabled = false, name, value, ...checkboxProps } = handle.props
    let itemDisabled = disabled || context.disabled

    context.registerItem({ disabled: itemDisabled, value })

    return createElement(
      CheckboxProvider,
      {
        ...checkboxProps,
        checked: context.getItemChecked(value),
        disabled: itemDisabled,
        name: name ?? context.name,
        onCheckedChange(nextChecked: CheckboxState) {
          context.setItemChecked(value, nextChecked)
        },
        value,
      },
      children,
    )
  }
}

const controlMixin: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
  HTMLElement,
  [],
  ElementProps
>((handle) => {
  let context = getCheckboxContext(handle)

  return () => [
    attrs({
      'aria-checked': context.mixed ? 'mixed' : context.checkedValue,
      'aria-disabled': context.disabled || undefined,
      'aria-readonly': context.readOnly || undefined,
      'aria-required': context.required || undefined,
      'data-state': context.mixed ? 'mixed' : context.checkedValue ? 'checked' : 'unchecked',
      role: 'checkbox',
      tabIndex: context.disabled ? undefined : (context.tabIndex ?? 0),
    }),
    on<HTMLElement, 'click'>('click', (event) => {
      event.preventDefault()

      if (context.disabled || context.readOnly) {
        return
      }

      context.toggleChecked()
    }),
    on<HTMLElement, 'keydown'>('keydown', (event) => {
      if (event.key !== ' ') {
        return
      }

      event.preventDefault()
      context.toggleChecked()
    }),
  ]
})

const hiddenInputMixin: MixinFactory<HTMLInputElement, [], ElementProps> = createMixin<
  HTMLInputElement,
  [],
  ElementProps
>((handle) => {
  let context = getCheckboxContext(handle)

  return () => [
    attrs({
      'aria-hidden': 'true',
      checked: context.checkedValue,
      disabled: context.disabled || undefined,
      form: context.form,
      id: context.inputId,
      name: context.name,
      required: context.required,
      tabIndex: -1,
      type: 'checkbox',
      value: context.value,
    }),
    ref((node: HTMLInputElement, signal) => {
      context.setInput(node, signal)
      signal.addEventListener('abort', () => {
        context.setInput(null)
      })
    }),
    on<HTMLInputElement, 'click'>('click', (event) => {
      if (!context.readOnly) {
        return
      }

      event.preventDefault()
      event.currentTarget.checked = context.checkedValue
      event.currentTarget.indeterminate = context.mixed
    }),
    on<HTMLInputElement, 'change'>('change', (event) => {
      if (context.readOnly) {
        event.preventDefault()
        event.currentTarget.checked = context.checkedValue
        event.currentTarget.indeterminate = context.mixed
        return
      }

      context.setChecked(event.currentTarget.checked)
    }),
  ]
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

export function UncheckedInput(handle: Handle): () => RemixNode {
  return () => {
    let context = getCheckboxContext(handle)

    if (context.checkedValue || !context.name || context.uncheckedValue === undefined) {
      return null
    }

    return createElement('input', {
      disabled: context.disabled || undefined,
      form: context.form,
      name: context.name,
      type: 'hidden',
      value: context.uncheckedValue,
    })
  }
}

export const Context = CheckboxProvider
export const GroupContext = CheckboxGroupProvider
export const ItemContext = CheckboxItemProvider
export const ParentContext = CheckboxParentProvider
export const control = controlMixin
export const group = groupMixin
export const hiddenInput = hiddenInputMixin

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

export type CheckboxControlProps = Props<'span'>
