import { createMixin, css } from '@remix-run/ui'
import type {
  CSSMixinDescriptor,
  ElementProps,
  Handle,
  MixinDescriptor,
  Props,
  RemixNode,
} from '@remix-run/ui'
import * as checkboxPrimitive from '@remix-run/ui/checkbox'
import { renderMixinElement } from '../../runtime/mixins/mixin.ts'

export {
  CheckboxChangeEvent,
  CheckboxGroupChangeEvent,
  onCheckboxChange,
  onCheckboxGroupChange,
} from '@remix-run/ui/checkbox'

export type CheckboxSize = 'md' | 'lg'
export type CheckboxState = checkboxPrimitive.CheckboxState

export interface CheckboxOptions {
  size?: CheckboxSize
}

export interface CheckboxProps
  extends Omit<
    Props<'input'>,
    | 'aria-checked'
    | 'aria-disabled'
    | 'checked'
    | 'children'
    | 'defaultChecked'
    | 'disabled'
    | 'name'
    | 'onChange'
    | 'readOnly'
    | 'role'
    | 'size'
    | 'type'
    | 'value'
  > {
  checked?: CheckboxState
  defaultChecked?: CheckboxState
  disabled?: boolean
  form?: string
  inputRef?: (input: HTMLInputElement, signal: AbortSignal) => void
  name?: string
  onCheckedChange?: (checked: CheckboxState) => void
  readOnly?: boolean
  required?: boolean
  size?: CheckboxSize
  tabIndex?: number
  value?: string
}

export interface CheckboxGroupProps
  extends Omit<
    Props<'div'>,
    'aria-disabled' | 'children' | 'defaultValue' | 'onChange' | 'role' | 'value'
  > {
  children?: RemixNode
  defaultValue?: string[]
  disabled?: boolean
  name?: string
  onValueChange?: (value: string[]) => void
  value?: string[]
}

export interface CheckboxGroupParentProps
  extends Omit<
    Props<'input'>,
    | 'checked'
    | 'children'
    | 'defaultChecked'
    | 'name'
    | 'onChange'
    | 'role'
    | 'size'
    | 'type'
    | 'value'
  > {
  inputRef?: (input: HTMLInputElement, signal: AbortSignal) => void
  size?: CheckboxSize
}

export interface CheckboxItemProps
  extends Omit<
    Props<'input'>,
    'checked' | 'children' | 'defaultChecked' | 'onChange' | 'role' | 'size' | 'type' | 'value'
  > {
  inputId?: string
  inputRef?: (input: HTMLInputElement, signal: AbortSignal) => void
  size?: CheckboxSize
  value: string
}

type CheckboxMixin = readonly [
  MixinDescriptor<Element, [], ElementProps>,
  CSSMixinDescriptor,
  CSSMixinDescriptor,
]

const checkedSelector = '&:checked, &[aria-checked="true"], &[data-state="checked"]'
const mixedSelector =
  '&:indeterminate, &[indeterminate], &[aria-checked="mixed"], &[data-state="mixed"]'
const checkedMarkSelector =
  '&:checked::before, &[aria-checked="true"]::before, &[data-state="checked"]::before'
const mixedMarkSelector =
  '&:indeterminate::before, &[indeterminate]::before, &[aria-checked="mixed"]::before, &[data-state="mixed"]::before'
const enabledSelector = ':not(:disabled):not([aria-disabled="true"])'
const checkedActiveSelector =
  '&:checked:active:not(:disabled):not([aria-disabled="true"]), &[aria-checked="true"]:active:not(:disabled):not([aria-disabled="true"]), &[data-state="checked"]:active:not(:disabled):not([aria-disabled="true"])'
const mixedActiveSelector =
  '&:indeterminate:active:not(:disabled):not([aria-disabled="true"]), &[indeterminate]:active:not(:disabled):not([aria-disabled="true"]), &[aria-checked="mixed"]:active:not(:disabled):not([aria-disabled="true"]), &[data-state="mixed"]:active:not(:disabled):not([aria-disabled="true"])'
const checkIconUrl =
  "url(\"data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 12 12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cg filter='url(%23filter0_d_2_2264)'%3E%3Cpath d='M2.75 5.76562L5.10156 8.25L9.23438 1.75' stroke='white' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M2.75 5.76562L5.10156 8.25L9.23438 1.75' stroke='url(%23paint0_linear_2_2264)' stroke-opacity='0.1' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/g%3E%3Cdefs%3E%3Cfilter id='filter0_d_2_2264' x='0' y='0' width='11.9845' height='12' filterUnits='userSpaceOnUse' color-interpolation-filters='sRGB'%3E%3CfeFlood flood-opacity='0' result='BackgroundImageFix'/%3E%3CfeColorMatrix in='SourceAlpha' type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0' result='hardAlpha'/%3E%3CfeOffset dy='1'/%3E%3CfeGaussianBlur stdDeviation='1'/%3E%3CfeComposite in2='hardAlpha' operator='out'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.4 0'/%3E%3CfeBlend mode='overlay' in2='BackgroundImageFix' result='effect1_dropShadow_2_2264'/%3E%3CfeBlend mode='normal' in='SourceGraphic' in2='effect1_dropShadow_2_2264' result='shape'/%3E%3C/filter%3E%3ClinearGradient id='paint0_linear_2_2264' x1='5.99219' y1='1.75' x2='5.99219' y2='8.25' gradientUnits='userSpaceOnUse'%3E%3Cstop offset='0.25' stop-color='%233573F6' stop-opacity='0'/%3E%3Cstop offset='1' stop-color='%233573F6'/%3E%3C/linearGradient%3E%3C/defs%3E%3C/svg%3E\")"

const checkboxDefaultAttrs = createMixin<Element, [], ElementProps>(
  (handle, hostType) => (props) => {
    if (hostType !== 'input' || props.type !== undefined) {
      return handle.element
    }

    return renderMixinElement(handle.element, {
      ...props,
      type: 'checkbox',
    })
  },
)()

const baseStyle: CSSMixinDescriptor = css({
  appearance: 'none',
  WebkitAppearance: 'none',
  margin: 0,
  boxSizing: 'border-box',
  position: 'relative',
  display: 'inline-grid',
  placeItems: 'center',
  width: 'var(--rmx-checkbox-size)',
  height: 'var(--rmx-checkbox-size)',
  minWidth: 'var(--rmx-checkbox-size)',
  minHeight: 'var(--rmx-checkbox-size)',
  padding: 0,
  border: 0,
  borderRadius: 'var(--rmx-checkbox-radius)',
  background: '#FFFFFF',
  boxShadow:
    '0 2px 2px -1px rgba(0, 0, 0, 0.05), 0 3px 4px -1.5px rgba(0, 0, 0, 0.05), 0 4px 8px -2px rgba(0, 0, 0, 0.05), 0 5px 16px -2.5px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(0, 0, 0, 0.12)',
  color: '#FFFFFF',
  verticalAlign: 'middle',
  flex: 'none',
  '&::before': {
    content: '""',
    position: 'absolute',
    opacity: 0,
    pointerEvents: 'none',
  },
  '&:focus-visible': {
    outline: '2px solid #1A72FF',
    outlineOffset: '2px',
  },
  '&:disabled, &[aria-disabled="true"]': {
    opacity: 0.55,
  },
  [`${checkedSelector}, ${mixedSelector}`]: {
    background:
      'linear-gradient(180deg, rgba(0, 0, 0, 0) 24.52%, rgba(0, 0, 0, 0.1) 100%), #3573F6',
    backgroundBlendMode: 'overlay, normal',
    borderRadius: 'var(--rmx-checkbox-active-radius)',
    boxShadow:
      '0 1px 1px -0.5px rgba(9, 68, 190, 0.12), 0 2px 2px -1px rgba(9, 68, 190, 0.12), 0 4px 4px -2px rgba(9, 68, 190, 0.12), 0 8px 8px -4px rgba(9, 68, 190, 0.12), 0 2px 8px rgba(53, 115, 246, 0.4), inset 0 0 3px 1px rgba(0, 0, 0, 0.1)',
  },
  [checkedMarkSelector]: {
    opacity: 1,
    left: '50%',
    top: '50%',
    width: 'var(--rmx-checkbox-check-size)',
    height: 'var(--rmx-checkbox-check-size)',
    background: `${checkIconUrl} center / contain no-repeat`,
    transform: 'translate(-50%, calc(-50% + var(--rmx-checkbox-check-y)))',
  },
  [mixedMarkSelector]: {
    opacity: 1,
    left: '50%',
    top: '50%',
    width: 'var(--rmx-checkbox-mixed-width)',
    height: 'var(--rmx-checkbox-mixed-height)',
    border: 0,
    borderRadius: '999px',
    background: 'currentColor',
    filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4))',
    transform: 'translate(-50%, -50%)',
  },
  [`&:active${enabledSelector}`]: {
    boxShadow:
      '0 1px 1px -0.5px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.14), inset 0 1px 2px rgba(0, 0, 0, 0.08)',
  },
  [`${checkedActiveSelector}, ${mixedActiveSelector}`]: {
    boxShadow:
      '0 1px 1px -0.5px rgba(9, 68, 190, 0.1), 0 2px 2px -1px rgba(9, 68, 190, 0.1), 0 4px 4px -2px rgba(9, 68, 190, 0.1), 0 6px 8px -4px rgba(9, 68, 190, 0.1), 0 2px 6px rgba(53, 115, 246, 0.32), inset 0 1px 2px rgba(0, 0, 0, 0.3), inset 0 0 3px 1px rgba(0, 0, 0, 0.12)',
  },
})

const sizeStyles = {
  md: css({
    '--rmx-checkbox-size': '16px',
    '--rmx-checkbox-radius': '4px',
    '--rmx-checkbox-active-radius': '5px',
    '--rmx-checkbox-check-size': '12px',
    '--rmx-checkbox-check-y': '1px',
    '--rmx-checkbox-mixed-width': '7px',
    '--rmx-checkbox-mixed-height': '2px',
  }),
  lg: css({
    '--rmx-checkbox-size': '20px',
    '--rmx-checkbox-radius': '5px',
    '--rmx-checkbox-active-radius': '6px',
    '--rmx-checkbox-check-size': '15px',
    '--rmx-checkbox-check-y': '1.25px',
    '--rmx-checkbox-mixed-width': '9px',
    '--rmx-checkbox-mixed-height': '2.25px',
  }),
} as const satisfies Record<CheckboxSize, CSSMixinDescriptor>

export function checkbox(options: CheckboxOptions = {}): CheckboxMixin {
  let { size = 'md' } = options
  return [checkboxDefaultAttrs, baseStyle, sizeStyles[size]]
}

export function Checkbox(handle: Handle<CheckboxProps>) {
  return () => {
    let {
      checked,
      defaultChecked,
      disabled,
      form,
      inputRef,
      mix,
      name,
      onCheckedChange,
      readOnly,
      required,
      size = 'md',
      tabIndex,
      value,
      ...inputProps
    } = handle.props

    return (
      <input
        {...inputProps}
        type="checkbox"
        mix={[
          checkbox({ size }),
          checkboxPrimitive.control({
            checked,
            defaultChecked,
            disabled,
            form,
            inputRef,
            name,
            onCheckedChange,
            readOnly,
            required,
            tabIndex,
            value,
          }),
          mix,
        ]}
      />
    )
  }
}

export function CheckboxGroup(handle: Handle<CheckboxGroupProps>): () => RemixNode {
  return () => {
    let {
      children,
      defaultValue,
      disabled = false,
      mix,
      name,
      onValueChange,
      value,
      ...divProps
    } = handle.props

    return (
      <checkboxPrimitive.GroupContext
        defaultValue={defaultValue}
        disabled={disabled}
        name={name}
        onValueChange={onValueChange}
        value={value}
      >
        <div {...divProps} mix={[checkboxPrimitive.group(), mix]}>
          {children}
        </div>
      </checkboxPrimitive.GroupContext>
    )
  }
}

export function CheckboxGroupParent(handle: Handle<CheckboxGroupParentProps>): () => RemixNode {
  return () => {
    let {
      disabled,
      form,
      inputRef,
      mix,
      readOnly,
      required,
      size = 'md',
      tabIndex,
      ...inputProps
    } = handle.props

    return (
      <input
        {...inputProps}
        type="checkbox"
        mix={[
          checkbox({ size }),
          checkboxPrimitive.parent({
            disabled,
            form,
            inputRef,
            readOnly,
            required,
            tabIndex,
          }),
          mix,
        ]}
      />
    )
  }
}

export function CheckboxItem(handle: Handle<CheckboxItemProps>): () => RemixNode {
  return () => {
    let {
      disabled,
      form,
      inputId,
      inputRef,
      mix,
      name,
      readOnly,
      required,
      size = 'md',
      tabIndex,
      value,
      ...inputProps
    } = handle.props

    return (
      <input
        {...inputProps}
        type="checkbox"
        mix={[
          checkbox({ size }),
          checkboxPrimitive.item({
            disabled,
            form,
            inputId,
            inputRef,
            name,
            readOnly,
            required,
            tabIndex,
            value,
          }),
          mix,
        ]}
      />
    )
  }
}

export default checkbox
