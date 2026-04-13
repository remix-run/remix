// @jsxRuntime classic
// @jsx createElement
import {
  css,
  createElement,
  on,
  pressEvents,
  ref,
  type Handle,
  type Props,
  type RemixNode,
} from '@remix-run/component'
import { Glyph } from '../glyph/glyph.tsx'
import { ui } from '../theme/theme.ts'

export let accordionChangeEventType = 'rmx:accordion-change' as const

declare global {
  interface HTMLElementEventMap {
    [accordionChangeEventType]: AccordionChangeEvent
  }
}

export class AccordionChangeEvent extends Event {
  accordionType: AccordionType
  itemValue: string
  value: string | null | string[]

  constructor(
    value: string | null | string[],
    init: {
      accordionType: AccordionType
      itemValue: string
    },
  ) {
    super(accordionChangeEventType, {
      bubbles: true,
    })
    this.accordionType = init.accordionType
    this.itemValue = init.itemValue
    this.value = value
  }
}

type AccordionType = 'single' | 'multiple'
type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

type AccordionBaseProps = Omit<Props<'div'>, 'children'> & {
  children?: RemixNode
  disabled?: boolean
  headingLevel?: HeadingLevel
}

export type AccordionSingleProps = AccordionBaseProps & {
  type?: 'single'
  value?: string | null
  defaultValue?: string | null
  onValueChange?: (value: string | null) => void
  collapsible?: boolean
}

export type AccordionMultipleProps = AccordionBaseProps & {
  type: 'multiple'
  value?: string[]
  defaultValue?: string[]
  onValueChange?: (value: string[]) => void
}

export type AccordionProps = AccordionSingleProps | AccordionMultipleProps

export type AccordionItemProps = Omit<Props<'div'>, 'children'> & {
  children?: RemixNode
  disabled?: boolean
  value: string
}

export type AccordionTriggerProps = Omit<Props<'button'>, 'children' | 'type'> & {
  children?: RemixNode
  indicator?: RemixNode | null
  type?: 'button' | 'submit' | 'reset'
}

export type AccordionContentProps = Omit<Props<'div'>, 'children'> & {
  children?: RemixNode
}

type RegisteredItem = {
  disabled: boolean
  getTriggerNode(): HTMLButtonElement | null
  value: string
}

type AccordionContext = {
  collapsible: boolean
  disabled: boolean
  focusItem(value: string, direction: FocusDirection): void
  getPanelId(value: string): string | undefined
  getTriggerId(value: string): string | undefined
  headingLevel: HeadingLevel
  isOpen(value: string): boolean
  registerItem(item: RegisteredItem): void
  toggleItem(value: string): void
  type: AccordionType
}

type AccordionItemContext = {
  disabled: boolean
  headingLevel: HeadingLevel
  lockedOpen: boolean
  open: boolean
  panelId: string
  setTriggerNode(node: HTMLButtonElement | null): void
  triggerId: string
  value: string
}

type FocusDirection = 'first' | 'last' | 'next' | 'previous'

type AccordionComponent = typeof AccordionComponentImpl & {
  readonly change: typeof accordionChangeEventType
}

let accordionPanelClipCss = css({
  minHeight: 0,
  overflow: 'hidden',
})

function isMultipleProps(props: AccordionProps | null): props is AccordionMultipleProps {
  return props?.type === 'multiple'
}

function AccordionComponentImpl(handle: Handle<AccordionContext>) {
  let rootNode: HTMLElement | null = null
  let registeredItems: RegisteredItem[] = []
  let currentProps: AccordionProps | null = null
  let uncontrolledSingleValue: string | null = null
  let uncontrolledMultipleValue: string[] = []
  let hasInitializedSingle = false
  let hasInitializedMultiple = false

  let getType = () => (isMultipleProps(currentProps) ? 'multiple' : 'single')

  let getSingleValue = () => {
    if (!currentProps || isMultipleProps(currentProps)) {
      return null
    }

    if (currentProps.value !== undefined) {
      return currentProps.value
    }

    if (!hasInitializedSingle) {
      uncontrolledSingleValue = currentProps.defaultValue ?? null
      hasInitializedSingle = true
    }

    return uncontrolledSingleValue
  }

  let getMultipleValue = () => {
    if (!isMultipleProps(currentProps)) {
      return []
    }

    if (currentProps.value !== undefined) {
      return currentProps.value
    }

    if (!hasInitializedMultiple) {
      uncontrolledMultipleValue = [...(currentProps.defaultValue ?? [])]
      hasInitializedMultiple = true
    }

    return uncontrolledMultipleValue
  }

  let isOpen = (value: string) => {
    if (getType() === 'multiple') {
      return getMultipleValue().includes(value)
    }

    return getSingleValue() === value
  }

  let dispatchChange = (itemValue: string, value: string | null | string[]) => {
    rootNode?.dispatchEvent(
      new AccordionChangeEvent(value, {
        accordionType: getType(),
        itemValue,
      }),
    )
  }

  let toggleItem = (itemValue: string) => {
    if (!currentProps || currentProps.disabled) {
      return
    }

    if (isMultipleProps(currentProps)) {
      let currentValue = getMultipleValue()
      let nextValue = currentValue.includes(itemValue)
        ? currentValue.filter((value) => value !== itemValue)
        : [...currentValue, itemValue]

      if (currentProps.value === undefined) {
        uncontrolledMultipleValue = nextValue
        void handle.update()
      }

      currentProps.onValueChange?.(nextValue)
      dispatchChange(itemValue, nextValue)
      return
    }

    let isCurrentItemOpen = getSingleValue() === itemValue
    if (isCurrentItemOpen && !(currentProps.collapsible ?? true)) {
      return
    }

    let nextValue = isCurrentItemOpen ? null : itemValue

    if (currentProps.value === undefined) {
      uncontrolledSingleValue = nextValue
      void handle.update()
    }

    currentProps.onValueChange?.(nextValue)
    dispatchChange(itemValue, nextValue)
  }

  let focusItem = (itemValue: string, direction: FocusDirection) => {
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

  let registerItem = (item: RegisteredItem) => {
    registeredItems.push(item)
  }

  let getTriggerId = (value: string) =>
    registeredItems.find((item) => item.value === value)?.getTriggerNode()?.id

  let getPanelId = (value: string) => `${handle.id}-${value}-panel`

  return (props: AccordionProps) => {
    let collapsible = 'collapsible' in props ? props.collapsible : undefined
    let {
      children,
      defaultValue,
      disabled,
      headingLevel,
      mix,
      onValueChange,
      type,
      value,
      ...divProps
    } = props
    void defaultValue
    void onValueChange
    void value
    currentProps = props
    registeredItems = []

    handle.context.set({
      collapsible: type === 'multiple' ? true : (collapsible ?? true),
      disabled: disabled ?? false,
      focusItem,
      getPanelId,
      getTriggerId,
      headingLevel: headingLevel ?? 3,
      isOpen,
      registerItem,
      toggleItem,
      type: type ?? 'single',
    })

    return (
      <div
        {...divProps}
        data-disabled={disabled ? '' : undefined}
        data-type={type ?? 'single'}
        mix={[
          ui.accordion.root,
          ref((node) => {
            rootNode = node as HTMLElement
          }),
          ...(mix ?? []),
        ]}
      >
        {children}
      </div>
    )
  }
}

export let Accordion: AccordionComponent = Object.assign(AccordionComponentImpl, {
  change: accordionChangeEventType,
})

export function AccordionItem(handle: Handle<AccordionItemContext>) {
  let triggerNode: HTMLButtonElement | null = null
  let triggerId = `${handle.id}-trigger`
  let panelId = `${handle.id}-panel`

  return (props: AccordionItemProps) => {
    let { children, disabled: itemDisabled, mix, value, ...divProps } = props
    let accordion = handle.context.get(Accordion)
    let disabled = accordion.disabled || itemDisabled === true
    let open = accordion.isOpen(value)
    let lockedOpen = accordion.type === 'single' && !accordion.collapsible && open

    accordion.registerItem({
      disabled,
      getTriggerNode: () => triggerNode,
      value,
    })

    handle.context.set({
      disabled,
      headingLevel: accordion.headingLevel,
      lockedOpen,
      open,
      panelId,
      setTriggerNode(node) {
        triggerNode = node
      },
      triggerId,
      value,
    })

    return (
      <div
        {...divProps}
        data-disabled={disabled ? '' : undefined}
        data-state={open ? 'open' : 'closed'}
        mix={[ui.accordion.item, ...(mix ?? [])]}
      >
        {children}
      </div>
    )
  }
}

export function AccordionTrigger(handle: Handle) {
  return (props: AccordionTriggerProps) => {
    let accordion = handle.context.get(Accordion)
    let item = handle.context.get(AccordionItem)
    let headingTag = `h${item.headingLevel}` as keyof JSX.IntrinsicElements
    let disabled = item.disabled || props.disabled === true

    let { children, indicator, mix, type, ...buttonProps } = props

    let button = (
      <button
        {...buttonProps}
        aria-controls={item.panelId}
        aria-disabled={item.lockedOpen ? true : undefined}
        aria-expanded={item.open}
        data-state={item.open ? 'open' : 'closed'}
        disabled={disabled ? true : undefined}
        id={item.triggerId}
        mix={[
          ui.accordion.trigger,
          pressEvents(),
          ref((node) => {
            item.setTriggerNode(node as HTMLButtonElement)
          }),
          on(pressEvents.press, () => {
            if (disabled || item.lockedOpen) {
              return
            }

            accordion.toggleItem(item.value)
          }),
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
          ...(mix ?? []),
        ]}
        type={type ?? 'button'}
      >
        <span>{children}</span>
        {indicator === null ? null : (
          <span
            data-rmx-accordion-indicator=""
            data-state={item.open ? 'open' : 'closed'}
            mix={ui.accordion.indicator}
          >
            {indicator ?? <Glyph name="chevronRight" />}
          </span>
        )}
      </button>
    )

    return createElement(headingTag, {}, button)
  }
}

export function AccordionContent(handle: Handle) {
  return (props: AccordionContentProps) => {
    let item = handle.context.get(AccordionItem)
    let { children, mix, ...panelProps } = props

    return (
      <div
        {...panelProps}
        aria-hidden={item.open ? undefined : true}
        aria-labelledby={item.triggerId}
        data-state={item.open ? 'open' : 'closed'}
        id={item.panelId}
        inert={item.open ? undefined : true}
        mix={[ui.accordion.panel, mix ?? []]}
      >
        <div mix={accordionPanelClipCss}>
          <div mix={ui.accordion.body}>{children}</div>
        </div>
      </div>
    )
  }
}
