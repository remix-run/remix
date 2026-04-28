// @jsxRuntime classic
// @jsx createElement
import {
  css,
  createElement,
  on,
  ref,
  spring,
  type CSSMixinDescriptor,
  type Handle,
  type Props,
  type RemixNode,
} from '@remix-run/ui'
import { Glyph } from '../glyph/glyph.tsx'
import { theme } from '../theme/theme.ts'

const ACCORDION_CHANGE_EVENT = 'rmx:accordion-change' as const

type AccordionChangeHandler = (
  event: AccordionChangeEvent,
  signal: AbortSignal,
) => void | Promise<void>

declare global {
  interface HTMLElementEventMap {
    [ACCORDION_CHANGE_EVENT]: AccordionChangeEvent
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
    super(ACCORDION_CHANGE_EVENT, {
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

const accordionPanelClipCss = css({
  minHeight: 0,
  overflow: 'hidden',
})

const accordionTransition = spring()

const accordionRootCss: CSSMixinDescriptor = css({
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
})

const accordionItemCss: CSSMixinDescriptor = css({
  minWidth: 0,
})

const accordionTriggerCss: CSSMixinDescriptor = css({
  all: 'unset',
  boxSizing: 'border-box',
  cursor: 'revert',
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: theme.space.md,
  width: '100%',
  minHeight: theme.control.height.lg,
  padding: `${theme.space.md} 0`,
  color: theme.colors.text.primary,
  fontFamily: theme.fontFamily.sans,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.normal,
  fontWeight: theme.fontWeight.medium,
  textAlign: 'left',
  '&:hover:not(:disabled)': {
    backgroundColor: theme.surface.lvl1,
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.colors.focus.ring}`,
    outlineOffset: '2px',
  },
  '&:disabled': {
    opacity: 0.55,
  },
  '& > span:first-child': {
    minWidth: 0,
  },
})

const accordionIndicatorCss: CSSMixinDescriptor = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: theme.fontSize.sm,
  height: theme.fontSize.sm,
  color: theme.colors.text.muted,
  transition: `transform ${accordionTransition}`,
  '& > svg': {
    display: 'block',
    width: '100%',
    height: '100%',
  },
  '&[data-state="open"]': {
    transform: 'rotate(90deg)',
  },
})

const accordionPanelCss: CSSMixinDescriptor = css({
  display: 'grid',
  gridTemplateRows: '0fr',
  transition: `grid-template-rows ${accordionTransition}`,
  '&[data-state="open"]': {
    gridTemplateRows: '1fr',
  },
  '&[data-state="closed"]': {
    pointerEvents: 'none',
  },
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
  },
})

const accordionBodyCss: CSSMixinDescriptor = css({
  display: 'flow-root',
  minHeight: 0,
  paddingBottom: theme.space.md,
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.relaxed,
  '& > :first-child': {
    marginTop: 0,
  },
  '& > :last-child': {
    marginBottom: 0,
  },
})

export const rootStyle = accordionRootCss
export const itemStyle = accordionItemCss
export const triggerStyle = accordionTriggerCss
export const indicatorStyle = accordionIndicatorCss
export const panelStyle = accordionPanelCss
export const bodyStyle = accordionBodyCss

function isMultipleProps(props: AccordionProps | null): props is AccordionMultipleProps {
  return props?.type === 'multiple'
}

function AccordionImpl(handle: Handle<AccordionProps, AccordionContext>) {
  let rootNode: HTMLElement | null = null
  let registeredItems: RegisteredItem[] = []
  let uncontrolledSingleValue: string | null = null
  let uncontrolledMultipleValue: string[] = []
  let hasInitializedSingle = false
  let hasInitializedMultiple = false

  let getType = () => (isMultipleProps(handle.props) ? 'multiple' : 'single')

  let getSingleValue = () => {
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

  let getMultipleValue = () => {
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

  return () => {
    let collapsible = 'collapsible' in handle.props ? handle.props.collapsible : undefined
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
    } = handle.props
    void defaultValue
    void onValueChange
    void value
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
          rootStyle,
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

export function onAccordionChange(handler: AccordionChangeHandler, captureBoolean?: boolean) {
  return on<HTMLElement, typeof ACCORDION_CHANGE_EVENT>(
    ACCORDION_CHANGE_EVENT,
    handler,
    captureBoolean,
  )
}

export const Accordion = AccordionImpl

export function AccordionItem(handle: Handle<AccordionItemProps, AccordionItemContext>) {
  let triggerNode: HTMLButtonElement | null = null
  let triggerId = `${handle.id}-trigger`
  let panelId = `${handle.id}-panel`

  return () => {
    let { children, disabled: itemDisabled, mix, value, ...divProps } = handle.props
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
        mix={[itemStyle, ...(mix ?? [])]}
      >
        {children}
      </div>
    )
  }
}

export function AccordionTrigger(handle: Handle<AccordionTriggerProps>) {
  return () => {
    let accordion = handle.context.get(Accordion)
    let item = handle.context.get(AccordionItem)
    let headingTag = `h${item.headingLevel}` as keyof JSX.IntrinsicElements
    let { children, indicator, mix, type, ...buttonProps } = handle.props
    let disabled = item.disabled || handle.props.disabled === true
    let toggleItem = () => {
      if (disabled || item.lockedOpen) {
        return
      }

      accordion.toggleItem(item.value)
    }

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
          triggerStyle,
          ref((node) => {
            item.setTriggerNode(node as HTMLButtonElement)
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
          mix,
        ]}
        type={type ?? 'button'}
      >
        <span>{children}</span>
        {indicator === null ? null : (
          <span
            data-rmx-accordion-indicator=""
            data-state={item.open ? 'open' : 'closed'}
            mix={indicatorStyle}
          >
            {indicator ?? <Glyph name="chevronRight" />}
          </span>
        )}
      </button>
    )

    return createElement(headingTag, {}, button)
  }
}

export function AccordionContent(handle: Handle<AccordionContentProps>) {
  return () => {
    let item = handle.context.get(AccordionItem)
    let { children, mix, ...panelProps } = handle.props

    return (
      <div
        {...panelProps}
        aria-hidden={item.open ? undefined : true}
        aria-labelledby={item.triggerId}
        data-state={item.open ? 'open' : 'closed'}
        id={item.panelId}
        inert={item.open ? undefined : true}
        mix={[panelStyle, mix ?? []]}
      >
        <div mix={accordionPanelClipCss}>
          <div mix={bodyStyle}>{children}</div>
        </div>
      </div>
    )
  }
}
