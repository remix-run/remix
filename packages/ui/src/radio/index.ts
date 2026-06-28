import { createMixin, css } from '@remix-run/ui'
import type { CSSMixinDescriptor, ElementProps, MixinDescriptor } from '@remix-run/ui'
import { renderMixinElement } from '../runtime/mixins/mixin.ts'
import { controlFocusShadow } from '../shared/focus-styles.ts'

export type RadioSize = 'md' | 'lg'

export interface RadioOptions {
  size?: RadioSize
}

type RadioMixin = readonly [
  MixinDescriptor<Element, [], ElementProps>,
  CSSMixinDescriptor,
  CSSMixinDescriptor,
]

const checkedSelector = '&:checked, &[aria-checked="true"], &[data-state="checked"]'
const checkedMarkSelector =
  '&:checked::before, &[aria-checked="true"]::before, &[data-state="checked"]::before'

const radioDefaultAttrs = createMixin<Element, [], ElementProps>((handle, hostType) => (props) => {
  if (hostType !== 'input' || props.type !== undefined) {
    return handle.element
  }

  return renderMixinElement(handle.element, {
    ...props,
    type: 'radio',
  })
})()

const baseStyle: CSSMixinDescriptor = css({
  appearance: 'none',
  WebkitAppearance: 'none',
  margin: 0,
  boxSizing: 'border-box',
  position: 'relative',
  display: 'inline-grid',
  placeItems: 'center',
  width: 'var(--rmx-radio-size)',
  height: 'var(--rmx-radio-size)',
  minWidth: 'var(--rmx-radio-size)',
  minHeight: 'var(--rmx-radio-size)',
  padding: 0,
  border: '1px solid rgba(0, 0, 0, 0.12)',
  borderRadius: '9999px',
  background: '#FFFFFF',
  boxShadow: 'inset 0 1px 1px rgba(0, 0, 0, 0.06), inset 0 2px 2px rgba(0, 0, 0, 0.06)',
  verticalAlign: 'middle',
  flex: 'none',
  '&::before': {
    content: '""',
    width: 'var(--rmx-radio-mark-size)',
    height: 'var(--rmx-radio-mark-size)',
    borderRadius: '99px',
    background:
      'linear-gradient(180deg, rgba(53, 115, 246, 0) 25%, rgba(53, 115, 246, 0.15) 100%), #FFFFFF',
    boxShadow:
      '0 1px 1px -0.5px #0944BE, 0 2px 2px -1px #0944BE, 0 4px 4px -2px #0944BE, 0 0 1px 1px rgba(0, 0, 0, 0.25), inset 0 0 2px 1px #FFFFFF',
    opacity: 0,
    pointerEvents: 'none',
  },
  '&:disabled, &[aria-disabled="true"]': {
    opacity: 0.55,
  },
  [checkedSelector]: {
    border: 0,
    borderRadius: '99px',
    background: 'linear-gradient(180deg, rgba(0, 0, 0, 0.1) 0%, rgba(0, 0, 0, 0) 75.48%), #3573F6',
    backgroundBlendMode: 'overlay, normal',
    boxShadow:
      '0 1px 0 rgba(255, 255, 255, 0.6), 0 0 16px rgba(53, 115, 246, 0.25), inset 0 0 3px 1px rgba(0, 0, 0, 0.1)',
  },
  [checkedMarkSelector]: {
    opacity: 1,
  },
  '&:focus-visible': {
    outline: 0,
    boxShadow: controlFocusShadow,
  },
})

const sizeStyles = {
  md: css({
    '--rmx-radio-size': '16px',
    '--rmx-radio-mark-size': '8px',
  }),
  lg: css({
    '--rmx-radio-size': '20px',
    '--rmx-radio-mark-size': '10px',
  }),
} as const satisfies Record<RadioSize, CSSMixinDescriptor>

export function radio(options: RadioOptions = {}): RadioMixin {
  let { size = 'md' } = options
  return [radioDefaultAttrs, baseStyle, sizeStyles[size]]
}

export default radio
