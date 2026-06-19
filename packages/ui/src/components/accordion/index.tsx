import {
  css,
  createElement,
  type CSSMixinDescriptor,
  type Handle,
  type Props,
  type RemixNode,
} from '@remix-run/ui'

import { spring } from '@remix-run/ui/animation'
import * as accordion from '@remix-run/ui/components/accordion/primitives'
import { ChevronRightIcon } from '../shared/icons.tsx'
import { componentStyleValues as styles } from '../shared/style-values.ts'

type AccordionBaseProps = Omit<Props<'div'>, 'children'> & {
  children?: RemixNode
  disabled?: boolean
  headingLevel?: accordion.AccordionHeadingLevel
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

const accordionHeadingCss: CSSMixinDescriptor = css({
  margin: 0,
  minWidth: 0,
})

const accordionTriggerCss: CSSMixinDescriptor = css({
  all: 'unset',
  boxSizing: 'border-box',
  cursor: 'pointer',
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: styles.space.md,
  width: '100%',
  minHeight: '28px',
  padding: `${styles.space.xs} 0`,
  color: styles.colors.text.primary,
  fontFamily: styles.fontFamily.sans,
  fontSize: styles.fontSize.sm,
  lineHeight: styles.lineHeight.normal,
  fontWeight: styles.fontWeight.medium,
  textAlign: 'left',
  '&:hover:not(:disabled)': {
    backgroundColor: styles.surface.lvl1,
  },
  '&:hover:not(:disabled) > span:first-child': {
    textDecorationLine: 'underline',
  },
  '&:focus-visible': {
    outline: `2px solid ${styles.colors.focus.ring}`,
    outlineOffset: '2px',
  },
  '&:disabled': {
    cursor: 'default',
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
  width: styles.fontSize.sm,
  height: styles.fontSize.sm,
  color: styles.colors.text.muted,
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
  paddingBottom: styles.space.md,
  color: styles.colors.text.secondary,
  fontSize: styles.fontSize.sm,
  lineHeight: styles.lineHeight.relaxed,
  '& > :first-child': {
    marginTop: 0,
  },
  '& > :last-child': {
    marginBottom: 0,
  },
})

export const rootStyle = accordionRootCss
export const itemStyle = accordionItemCss
export const headingStyle = accordionHeadingCss
export const triggerStyle = accordionTriggerCss
export const indicatorStyle = accordionIndicatorCss
export const panelStyle = accordionPanelCss
export const bodyStyle = accordionBodyCss

export function Accordion(handle: Handle<AccordionProps>): () => RemixNode {
  return () => {
    if (handle.props.type === 'multiple') {
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

      return (
        <accordion.Context
          defaultValue={defaultValue}
          disabled={disabled}
          headingLevel={headingLevel}
          onValueChange={onValueChange}
          type={type}
          value={value}
        >
          <div {...divProps} mix={[rootStyle, accordion.root(), mix]}>
            {children}
          </div>
        </accordion.Context>
      )
    }

    let {
      children,
      collapsible,
      defaultValue,
      disabled,
      headingLevel,
      mix,
      onValueChange,
      type,
      value,
      ...divProps
    } = handle.props

    return (
      <accordion.Context
        collapsible={collapsible}
        defaultValue={defaultValue}
        disabled={disabled}
        headingLevel={headingLevel}
        onValueChange={onValueChange}
        type={type}
        value={value}
      >
        <div {...divProps} mix={[rootStyle, accordion.root(), mix]}>
          {children}
        </div>
      </accordion.Context>
    )
  }
}

export function AccordionItem(handle: Handle<AccordionItemProps>): () => RemixNode {
  return () => {
    let { children, disabled, mix, value, ...divProps } = handle.props

    return (
      <accordion.ItemContext disabled={disabled} value={value}>
        <div {...divProps} mix={[itemStyle, accordion.item(), mix]}>
          {children}
        </div>
      </accordion.ItemContext>
    )
  }
}

export function AccordionTrigger(handle: Handle<AccordionTriggerProps>): () => RemixNode {
  return () => {
    let item = handle.context.get(accordion.ItemContext)
    let headingTag = `h${item.headingLevel}` as keyof JSX.IntrinsicElements
    let { children, disabled, indicator, mix, type, ...buttonProps } = handle.props

    let button = (
      <button
        {...buttonProps}
        mix={[triggerStyle, accordion.trigger({ disabled }), mix]}
        type={type ?? 'button'}
      >
        <span>{children}</span>
        {indicator === null ? null : (
          <span
            data-rmx-accordion-indicator=""
            data-state={item.open ? 'open' : 'closed'}
            mix={indicatorStyle}
          >
            {indicator ?? <ChevronRightIcon />}
          </span>
        )}
      </button>
    )

    return createElement(headingTag, { mix: headingStyle }, button)
  }
}

export function AccordionContent(handle: Handle<AccordionContentProps>): () => RemixNode {
  return () => {
    let { children, mix, ...panelProps } = handle.props

    return (
      <div {...panelProps} mix={[panelStyle, accordion.content(), mix]}>
        <div mix={accordionPanelClipCss}>
          <div mix={bodyStyle}>{children}</div>
        </div>
      </div>
    )
  }
}
