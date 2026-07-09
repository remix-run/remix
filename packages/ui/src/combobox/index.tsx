import { createElement, css } from '@remix-run/ui'
import type { CSSMixinDescriptor, Handle, Props, RemixNode } from '@remix-run/ui'

import * as combobox from '@remix-run/ui/combobox/primitives'
import type { SearchValue } from '../shared/typeahead.ts'
import { CheckIcon } from '../shared/icons.tsx'
import {
  listboxIndicatorStyle,
  listboxLabelStyle,
  listboxListStyle,
  listboxOptionStyle,
  popoverSurfaceStyle,
} from '../shared/listbox-popover-styles.ts'
import { componentStyleValues as styles } from '../shared/style-values.ts'

export interface ComboboxProps extends Omit<Props<'div'>, 'children'> {
  children?: RemixNode
  defaultValue?: string | null
  disabled?: boolean
  inputId?: string
  name?: string
  placeholder?: string
}

export interface ComboboxOptionProps extends Omit<Props<'div'>, 'children'> {
  children?: RemixNode
  disabled?: boolean
  label: string
  searchValue?: SearchValue
  value: string
}

const comboboxPopoverCss: CSSMixinDescriptor = css({
  opacity: 0,
  '&:popover-open': {
    opacity: 1,
  },
  '&:not(:popover-open)': {
    pointerEvents: 'none',
  },
  '&[data-show-reason="nav"]:not(:popover-open)': {
    transition: 'opacity 180ms ease-in, overlay 180ms ease-in, display 180ms ease-in',
    transitionBehavior: 'allow-discrete',
  },
  '&[data-show-reason="hint"]:not(:popover-open)': {
    transition: 'none',
    transitionBehavior: 'normal',
  },
})

const comboboxInputCss: CSSMixinDescriptor = css({
  minHeight: styles.control.height.sm,
  width: '100%',
  paddingInline: styles.space.sm,
  border: `0.5px solid ${styles.colors.border.default}`,
  borderRadius: styles.radius.md,
  backgroundColor: styles.surface.lvl0,
  color: styles.colors.text.primary,
  fontFamily: styles.fontFamily.sans,
  fontSize: styles.fontSize.sm,
  lineHeight: styles.lineHeight.normal,
  boxShadow: 'inset 0 1px 0 light-dark(rgb(255 255 255 / 0.7), rgb(255 255 255 / 0.08))',
  '&:focus-visible': {
    outline: `2px solid ${styles.colors.focus.ring}`,
    outlineOffset: styles.space.none,
  },
  '&[data-surface-visible="true"][aria-activedescendant]:focus-visible': {
    outline: 'none',
  },
})

export const inputStyle = comboboxInputCss
export const popoverStyle = comboboxPopoverCss

export function Combobox(handle: Handle<ComboboxProps>): () => RemixNode {
  return () => {
    let { children, defaultValue, disabled, inputId, name, placeholder, ...divProps } = handle.props

    return (
      <combobox.Context defaultValue={defaultValue} disabled={disabled} name={name}>
        <div {...divProps}>
          <input
            defaultValue={defaultValue ?? undefined}
            id={inputId}
            mix={[inputStyle, combobox.input()]}
            placeholder={placeholder}
          />
          <div mix={[popoverSurfaceStyle, popoverStyle, combobox.popover()]}>
            <div mix={[listboxListStyle, combobox.list()]}>{children}</div>
          </div>
          {name && <input mix={combobox.hiddenInput()} />}
        </div>
      </combobox.Context>
    )
  }
}

export function ComboboxOption(handle: Handle<ComboboxOptionProps>): () => RemixNode {
  return () => {
    let { children, disabled, label, mix, searchValue, value, ...divProps } = handle.props

    return (
      <div
        {...divProps}
        mix={[listboxOptionStyle, combobox.option({ disabled, label, searchValue, value }), mix]}
      >
        <CheckIcon mix={listboxIndicatorStyle} />
        <span mix={listboxLabelStyle}>{children ?? label}</span>
      </div>
    )
  }
}
