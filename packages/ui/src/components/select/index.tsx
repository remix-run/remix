import { createElement, css } from '@remix-run/ui'
import type { CSSMixinDescriptor, Handle, Props, RemixNode, SearchValue } from '@remix-run/ui'

import * as popover from '@remix-run/ui/components/popover'
import * as select from '@remix-run/ui/components/select/primitives'
import { CheckIcon, ChevronVerticalIcon } from '../shared/icons.tsx'
import {
  listboxIndicatorStyle,
  listboxLabelStyle,
  listboxListStyle,
  listboxOptionStyle,
  popoverSurfaceStyle,
} from '../shared/listbox-popover-styles.ts'

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

const selectTriggerShadow =
  '0 2px 3px -1px rgba(0, 0, 0, 0.04), 0 3px 4px -1.5px rgba(0, 0, 0, 0.04), 0 4px 5px -2px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.12)'

const selectTriggerFocusShadow =
  '0 2px 3px -1px rgba(0, 0, 0, 0.04), 0 3px 4px -1.5px rgba(0, 0, 0, 0.04), 0 4px 5px -2px rgba(0, 0, 0, 0.04), 0 0 0 1px #3573F6, 0 0 0 4px rgba(53, 115, 246, 0.1), 0 6px 32px 4px rgba(53, 115, 246, 0.08), inset 0 0 8px 1px rgba(53, 115, 246, 0.05)'

const selectTriggerCss: CSSMixinDescriptor = css({
  appearance: 'none',
  margin: 0,
  boxSizing: 'border-box',
  width: '100%',
  minWidth: 0,
  height: '32px',
  paddingBlock: '6px',
  paddingInlineStart: '12px',
  paddingInlineEnd: '8px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: '6px',
  border: 0,
  borderRadius: '8px',
  background: '#FFFFFF',
  boxShadow: selectTriggerShadow,
  color: '#101010',
  fontFamily: '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  fontStyle: 'normal',
  fontWeight: 400,
  fontSize: '13px',
  lineHeight: '20px',
  fontFeatureSettings: '"ss01" on, "cv01" on',
  letterSpacing: 0,
  textAlign: 'left',
  textShadow: '0 1px 0 #FFFFFF',
  whiteSpace: 'nowrap',
  '&:hover, &:focus-visible, &[aria-expanded="true"], &[aria-expanded="true"]:hover, &[aria-expanded="true"]:focus-visible':
    {
      background: '#FFFFFF',
      color: '#101010',
    },
  '&:active': {
    background: '#FFFFFF',
  },
  '&:focus-visible': {
    outline: 0,
    boxShadow: selectTriggerFocusShadow,
  },
  '&[aria-expanded="true"]': {
    boxShadow: selectTriggerFocusShadow,
  },
  '&:disabled': {
    opacity: 0.55,
  },
})

const triggerLabelCss: CSSMixinDescriptor = css({
  display: 'inline-flex',
  alignItems: 'center',
  flex: '1 1 auto',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
})

const triggerIconCss: CSSMixinDescriptor = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '16px',
  height: '16px',
  color: '#707070',
  flex: 'none',
  '& > svg': {
    display: 'block',
    width: '100%',
    height: '100%',
  },
})

export const triggerStyle = selectTriggerCss

function SelectLabel(handle: Handle): () => RemixNode {
  let context = handle.context.get(select.Context)

  return () => <span mix={triggerLabelCss}>{context.displayedLabel}</span>
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
        <button type="button" {...buttonProps} mix={[triggerStyle, select.trigger(), mix]}>
          <SelectLabel />
          <ChevronVerticalIcon mix={triggerIconCss} />
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
