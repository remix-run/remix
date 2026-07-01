import { createElement, css } from '@remix-run/ui'
import type { CSSMixinDescriptor, Handle, Props, RemixNode, SearchValue } from '@remix-run/ui'

import * as popover from '@remix-run/ui/popover'
import * as select from '@remix-run/ui/select'
import * as button from '../button/button.tsx'
import { CheckIcon, ChevronVerticalIcon } from '../shared/icons.tsx'
import {
  listboxIndicatorStyle,
  listboxLabelStyle,
  listboxListStyle,
  listboxOptionStyle,
  popoverSurfaceStyle,
} from '../shared/listbox-popover-styles.ts'
import { componentStyleValues as styles } from '../shared/style-values.ts'

export interface SelectProps extends Omit<Props<'button'>, 'children' | 'name'> {
  children?: RemixNode
  defaultLabel: string
  defaultValue?: string | null
  disabled?: boolean
  name?: string
}

export type SelectOptionProps = Props<'div'> & {
  children?: RemixNode
  disabled?: boolean
  label: string
  textValue?: SearchValue
  value: string
}

const selectTriggerCss: CSSMixinDescriptor = css({
  minHeight: styles.control.height.sm,
  width: '100%',
  paddingInline: styles.space.md,
  paddingInlineEnd: styles.space.sm,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: styles.space.sm,
  borderRadius: styles.radius.md,
  backgroundImage: 'none',
  border: '0.5px solid transparent',
  boxShadow: 'none',
  fontSize: styles.fontSize.xs,
  textAlign: 'left',
  backgroundColor: styles.surface.lvl3,
  color: styles.colors.text.secondary,
  '&:hover, &:focus-visible, &[aria-expanded="true"], &[aria-expanded="true"]:hover, &[aria-expanded="true"]:focus-visible':
    {
      backgroundColor: styles.surface.lvl4,
      color: styles.colors.text.primary,
    },
  '&:active': {
    backgroundColor: styles.surface.lvl3,
  },
  '&:focus-visible': {
    outline: `2px solid ${styles.colors.focus.ring}`,
    outlineOffset: '2px',
  },
  '&:disabled': {
    opacity: 0.6,
  },
})

export const triggerStyle = selectTriggerCss

function SelectLabel(handle: Handle): () => RemixNode {
  let context = handle.context.get(select.Context)

  return () => <span mix={button.labelStyle}>{context.displayedLabel}</span>
}

export function Select(handle: Handle<SelectProps>): () => RemixNode {
  return () => {
    let { children, defaultLabel, defaultValue, disabled, name, mix, ...buttonProps } = handle.props

    return (
      <select.Context
        defaultLabel={defaultLabel}
        defaultValue={defaultValue}
        disabled={disabled}
        name={name}
      >
        <button {...buttonProps} mix={[button.baseStyle, triggerStyle, select.trigger(), mix]}>
          <SelectLabel />
          <ChevronVerticalIcon mix={button.iconStyle} />
        </button>
        <popover.Context>
          <div mix={[popoverSurfaceStyle, select.popover()]}>
            <div mix={[listboxListStyle, select.list()]}>{children}</div>
          </div>
        </popover.Context>
        {name && <input mix={select.hiddenInput()} />}
      </select.Context>
    )
  }
}

export function Option(handle: Handle<SelectOptionProps>): () => RemixNode {
  return () => {
    let { label, value, disabled, textValue, children, mix, ...divProps } = handle.props

    return (
      <div
        {...divProps}
        mix={[listboxOptionStyle, select.option({ value, label, disabled, textValue }), mix]}
      >
        <CheckIcon mix={listboxIndicatorStyle} />
        <span mix={listboxLabelStyle}>{children ?? label}</span>
      </div>
    )
  }
}
