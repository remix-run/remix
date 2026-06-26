import {
  attrs,
  createMixin,
  on,
  ref,
  type Dispatched,
  type ElementProps,
  type Handle,
  type MixinHandle,
  type Props,
  type RemixNode,
} from '@remix-run/ui'

const ACCORDION_CHANGE_EVENT = 'rmx:accordion-change' as const

type AccordionChangeHandler<target extends HTMLElement> = (
  event: Dispatched<AccordionChangeEvent, target>,
  signal: AbortSignal,
) => void | Promise<void>

declare global {
  interface HTMLElementEventMap {
    [ACCORDION_CHANGE_EVENT]: AccordionChangeEvent
  }
}

export class AccordionChangeEvent extends Event {
  readonly accordionType: AccordionType
  readonly itemValue: string
  readonly value: AccordionValue

  constructor(
    value: AccordionValue,
    init: {
      accordionType: AccordionType
      itemValue: string
    },
  ) {
    super(ACCORDION_CHANGE_EVENT, {
      bubbles: true,
    })
    this.accordionType = init.accordionType
    this.itemValue = init.itemValue
    this.value = value
  }
}

export type AccordionType = 'single' | 'multiple'
export type AccordionValue = string | null | string[]
export type AccordionSingleValue = string | null
export type AccordionMultipleValue = string[]
export type AccordionHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

type FocusDirection = 'first' | 'last' | 'next' | 'previous'

type RegisteredItem = {
  disabled: boolean
  getTriggerNode(): HTMLButtonElement | null
  value: string
}

interface AccordionContextValue {
  readonly collapsible: boolean
  readonly disabled: boolean
  readonly headingLevel: AccordionHeadingLevel
  readonly type: AccordionType
  focusItem(value: string, direction: FocusDirection): void
  getPanelId(value: string): string
  getTriggerId(value: string): string | undefined
  isOpen(value: string): boolean
  registerItem(item: RegisteredItem): void
  registerRoot(node: HTMLElement): void
  toggleItem(value: string): void
  unregisterRoot(node: HTMLElement): void
}

interface AccordionItemContextValue {
  readonly disabled: boolean
  readonly headingLevel: AccordionHeadingLevel
  readonly lockedOpen: boolean
  readonly open: boolean
  readonly panelId: string
  readonly triggerId: string
  readonly value: string
  setTriggerNode(node: HTMLButtonElement | null): void
}

export interface AccordionBaseContextProps {
  children?: RemixNode
  disabled?: boolean
  headingLevel?: AccordionHeadingLevel
}

export interface AccordionSingleContextProps extends AccordionBaseContextProps {
  type?: 'single'
  value?: AccordionSingleValue
  defaultValue?: AccordionSingleValue
  onValueChange?: (value: AccordionSingleValue) => void
  collapsible?: boolean
}

export interface AccordionMultipleContextProps extends AccordionBaseContextProps {
  type: 'multiple'
  value?: AccordionMultipleValue
  defaultValue?: AccordionMultipleValue
  onValueChange?: (value: AccordionMultipleValue) => void
}

export type AccordionContextProps = AccordionSingleContextProps | AccordionMultipleContextProps

export interface AccordionRootOptions {}

export interface AccordionItemOptions {
  disabled?: boolean
  value: string
}

export interface AccordionTriggerOptions {
  disabled?: boolean
}

export interface AccordionContentOptions {}

export type AccordionProps = Props<'div'> & AccordionContextProps

export type AccordionItemProps = Omit<Props<'div'>, 'children'> &
  AccordionItemOptions & {
    children?: RemixNode
  }

export type AccordionTriggerProps = Omit<Props<'button'>, 'children' | 'type'> &
  AccordionTriggerOptions & {
    children?: RemixNode
    type?: 'button' | 'submit' | 'reset'
  }

export type AccordionContentProps = Omit<Props<'div'>, 'children'> & {
  children?: RemixNode
}

function isMultipleProps(
  props: AccordionContextProps | null,
): props is AccordionMultipleContextProps {
  return props?.type === 'multiple'
}

function getAccordionContext(handle: Handle<unknown, unknown> | MixinHandle) {
  return handle.context.get(AccordionProvider)
}

function getAccordionItemContext(handle: Handle<unknown, unknown> | MixinHandle) {
  return handle.context.get(AccordionItemProvider)
}

function AccordionProvider(
  handle: Handle<AccordionContextProps, AccordionContextValue>,
): () => RemixNode {
  let rootNode: HTMLElement | null = null
  let registeredItems: RegisteredItem[] = []
  let uncontrolledSingleValue: string | null = null
  let uncontrolledMultipleValue: string[] = []
  let hasInitializedSingle = false
  let hasInitializedMultiple = false

  function getType() {
    return isMultipleProps(handle.props) ? 'multiple' : 'single'
  }

  function getSingleValue() {
    if (isMultipleProps(handle.props)) {
      return null
    }

    if (handle.props.value !== undefined) {
      return handle.props.value
    }

    if (!hasInitializedSingle) {
      uncontrolledSingleValue = handle.props.defaultValue ?? null
      hasInitializedSingle = true
    }

    return uncontrolledSingleValue
  }

  function getMultipleValue() {
    if (!isMultipleProps(handle.props)) {
      return []
    }

    if (handle.props.value !== undefined) {
      return handle.props.value
    }

    if (!hasInitializedMultiple) {
      uncontrolledMultipleValue = [...(handle.props.defaultValue ?? [])]
      hasInitializedMultiple = true
    }

    return uncontrolledMultipleValue
  }

  function isOpen(value: string) {
    if (getType() === 'multiple') {
      return getMultipleValue().includes(value)
    }

    return getSingleValue() === value
  }

  function dispatchChange(itemValue: string, value: AccordionValue) {
    rootNode?.dispatchEvent(
      new AccordionChangeEvent(value, {
        accordionType: getType(),
        itemValue,
      }),
    )
  }

  function toggleItem(itemValue: string) {
    if (handle.props.disabled) {
      return
    }

    if (isMultipleProps(handle.props)) {
      let currentValue = getMultipleValue()
      let nextValue = currentValue.includes(itemValue)
        ? currentValue.filter((value) => value !== itemValue)
        : [...currentValue, itemValue]

      if (handle.props.value === undefined) {
        uncontrolledMultipleValue = nextValue
        void handle.update()
      }

      handle.props.onValueChange?.(nextValue)
      dispatchChange(itemValue, nextValue)
      return
    }

    let isCurrentItemOpen = getSingleValue() === itemValue
    if (isCurrentItemOpen && !(handle.props.collapsible ?? true)) {
      return
    }

    let nextValue = isCurrentItemOpen ? null : itemValue

    if (handle.props.value === undefined) {
      uncontrolledSingleValue = nextValue
      void handle.update()
    }

    handle.props.onValueChange?.(nextValue)
    dispatchChange(itemValue, nextValue)
  }

  function focusItem(itemValue: string, direction: FocusDirection) {
    let items = registeredItems.filter((item) => !item.disabled && item.getTriggerNode() !== null)
    if (items.length === 0) {
      return
    }

    let currentIndex = items.findIndex((item) => item.value === itemValue)
    let targetIndex = 0

    switch (direction) {
      case 'first':
        targetIndex = 0
        break
      case 'last':
        targetIndex = items.length - 1
        break
      case 'previous':
        targetIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1
        break
      case 'next':
        targetIndex =
          currentIndex === -1 || currentIndex === items.length - 1 ? 0 : currentIndex + 1
        break
    }

    items[targetIndex]?.getTriggerNode()?.focus()
  }

  function registerItem(item: RegisteredItem) {
    registeredItems.push(item)
  }

  function getTriggerId(value: string) {
    return registeredItems.find((item) => item.value === value)?.getTriggerNode()?.id
  }

  function getPanelId(value: string) {
    return `${handle.id}-${value}-panel`
  }

  handle.context.set({
    get collapsible() {
      return getType() === 'multiple'
        ? true
        : ((handle.props as AccordionSingleContextProps).collapsible ?? true)
    },
    get disabled() {
      return handle.props.disabled ?? false
    },
    focusItem,
    getPanelId,
    getTriggerId,
    get headingLevel() {
      return handle.props.headingLevel ?? 3
    },
    isOpen,
    registerItem,
    registerRoot(node) {
      rootNode = node
    },
    toggleItem,
    get type() {
      return getType()
    },
    unregisterRoot(node) {
      if (rootNode === node) {
        rootNode = null
      }
    },
  })

  return () => {
    registeredItems = []
    return handle.props.children
  }
}

function AccordionItemProvider(
  handle: Handle<AccordionItemOptions & { children?: RemixNode }, AccordionItemContextValue>,
): () => RemixNode {
  let triggerNode: HTMLButtonElement | null = null
  let triggerId = `${handle.id}-trigger`
  let panelId = `${handle.id}-panel`
  let disabled = false
  let headingLevel: AccordionHeadingLevel = 3
  let lockedOpen = false
  let open = false
  let value = handle.props.value

  handle.context.set({
    get disabled() {
      return disabled
    },
    get headingLevel() {
      return headingLevel
    },
    get lockedOpen() {
      return lockedOpen
    },
    get open() {
      return open
    },
    get panelId() {
      return panelId
    },
    setTriggerNode(node) {
      triggerNode = node
    },
    get triggerId() {
      return triggerId
    },
    get value() {
      return value
    },
  })

  return () => {
    let accordion = getAccordionContext(handle)
    value = handle.props.value
    disabled = accordion.disabled || handle.props.disabled === true
    headingLevel = accordion.headingLevel
    open = accordion.isOpen(handle.props.value)
    lockedOpen = accordion.type === 'single' && !accordion.collapsible && open

    accordion.registerItem({
      disabled,
      getTriggerNode: () => triggerNode,
      value: handle.props.value,
    })

    return handle.props.children
  }
}

const rootMixin = createMixin<HTMLElement, [options?: AccordionRootOptions], ElementProps>(
  (handle) => {
    let context = getAccordionContext(handle)
    let rootNode: HTMLElement | null = null

    handle.queueTask((node, signal) => {
      rootNode = node
      context.registerRoot(node)
      signal.addEventListener('abort', () => {
        if (rootNode === node) {
          rootNode = null
        }
        context.unregisterRoot(node)
      })
    })

    return () =>
      attrs({
        'data-disabled': context.disabled ? '' : undefined,
        'data-type': context.type,
      })
  },
)

const itemMixin = createMixin<HTMLElement, [options?: AccordionItemOptions], ElementProps>(
  (handle) => {
    let item = getAccordionItemContext(handle)

    return () =>
      attrs({
        'data-disabled': item.disabled ? '' : undefined,
        'data-state': item.open ? 'open' : 'closed',
      })
  },
)

const triggerMixin = createMixin<
  HTMLButtonElement,
  [options?: AccordionTriggerOptions],
  ElementProps
>((handle) => {
  let accordion = getAccordionContext(handle)
  let item = getAccordionItemContext(handle)

  return (options, props = options as ElementProps) => {
    options = props === options ? undefined : options
    let disabled = item.disabled || options?.disabled === true || props.disabled === true
    let toggleItem = () => {
      if (disabled || item.lockedOpen) {
        return
      }

      accordion.toggleItem(item.value)
    }

    return [
      attrs({
        'aria-controls': item.panelId,
        'aria-disabled': item.lockedOpen ? true : undefined,
        'aria-expanded': item.open,
        'data-state': item.open ? 'open' : 'closed',
        disabled: disabled ? true : undefined,
        id: item.triggerId,
      }),
      ref((node: HTMLButtonElement) => {
        item.setTriggerNode(node)
      }),
      on('click', toggleItem),
      on('keydown', (event) => {
        switch (event.key) {
          case 'ArrowDown':
            event.preventDefault()
            accordion.focusItem(item.value, 'next')
            break
          case 'ArrowUp':
            event.preventDefault()
            accordion.focusItem(item.value, 'previous')
            break
          case 'Home':
            event.preventDefault()
            accordion.focusItem(item.value, 'first')
            break
          case 'End':
            event.preventDefault()
            accordion.focusItem(item.value, 'last')
            break
        }
      }),
    ]
  }
})

const contentMixin = createMixin<HTMLElement, [options?: AccordionContentOptions], ElementProps>(
  (handle) => {
    let item = getAccordionItemContext(handle)

    return () =>
      attrs({
        'aria-hidden': item.open ? undefined : true,
        'aria-labelledby': item.triggerId,
        'data-state': item.open ? 'open' : 'closed',
        id: item.panelId,
        inert: item.open ? undefined : true,
      })
  },
)

export const Context = AccordionProvider
export const ItemContext: (
  handle: Handle<AccordionItemOptions & { children?: RemixNode }, AccordionItemContextValue>,
) => () => RemixNode = AccordionItemProvider
export const content = contentMixin
export const item = itemMixin
export const root = rootMixin
export const trigger = triggerMixin

export function onAccordionChange<target extends HTMLElement>(
  handler: AccordionChangeHandler<target>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof ACCORDION_CHANGE_EVENT>> {
  return on(ACCORDION_CHANGE_EVENT, handler, captureBoolean)
}
