import { createMixin, css } from '@remix-run/ui'
import type { CSSMixinDescriptor, ElementProps, MixinDescriptor } from '@remix-run/ui'
import { renderMixinElement } from '../runtime/mixins/mixin.ts'
import { controlFocusShadow } from '../shared/focus-styles.ts'

export type CheckboxSize = 'md' | 'lg'
export type CheckboxState = 'checked' | 'mixed' | 'unchecked'

export interface CheckboxOptions {
  size?: CheckboxSize
  state?: CheckboxState
}

type CheckboxMixin = readonly [
  MixinDescriptor<Element, [state?: CheckboxState], ElementProps>,
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

const checkboxAriaChecked = {
  checked: 'true',
  mixed: 'mixed',
  unchecked: 'false',
} as const satisfies Record<CheckboxState, 'true' | 'mixed' | 'false'>

const checkboxDefaultAttrs = createMixin<Element, [state?: CheckboxState], ElementProps>(
  (handle, hostType) => (state, props) => {
    let stateProps =
      state === undefined
        ? props
        : {
            ...props,
            'aria-checked': props['aria-checked'] ?? checkboxAriaChecked[state],
            'data-state': props['data-state'] ?? state,
          }

    if (hostType !== 'input' || stateProps.type !== undefined) {
      return state === undefined ? handle.element : renderMixinElement(handle.element, stateProps)
    }

    return renderMixinElement(handle.element, {
      ...stateProps,
      type: 'checkbox',
    })
  },
)

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
  '&:focus-visible': {
    outline: 0,
    boxShadow: controlFocusShadow,
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
  let { size = 'md', state } = options
  return [checkboxDefaultAttrs(state), baseStyle, sizeStyles[size]]
}

export default checkbox
