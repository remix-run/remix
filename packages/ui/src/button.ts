import { createMixin, css } from '@remix-run/ui'
import type { CSSMixinDescriptor, ElementProps, MixinDescriptor } from '@remix-run/ui'
import { renderMixinElement } from './runtime/mixins/mixin.ts'

export type ButtonSize = 'md' | 'lg'
export type ButtonTone = 'neutral' | 'primary'

export interface ButtonOptions {
  size?: ButtonSize
  tone?: ButtonTone
}

type ButtonMixin = readonly [
  MixinDescriptor<Element, [], ElementProps>,
  CSSMixinDescriptor,
  CSSMixinDescriptor,
  CSSMixinDescriptor,
]

const buttonDefaultAttrs = createMixin<Element, [], ElementProps>(
  (handle, hostType) => (props) => {
    if (hostType !== 'button' || props.type !== undefined) {
      return handle.element
    }

    return renderMixinElement(handle.element, {
      ...props,
      type: 'button',
    })
  },
)()

const baseStyle: CSSMixinDescriptor = css({
  all: 'unset',
  appearance: 'none',
  boxSizing: 'border-box',
  cursor: 'revert',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'row',
  gap: '4px',
  width: 'max-content',
  maxWidth: '100%',
  borderRadius: '999px',
  fontFamily: '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  fontStyle: 'normal',
  fontWeight: 500,
  fontFeatureSettings: '"cv01" on, "ss01" on',
  letterSpacing: 0,
  whiteSpace: 'nowrap',
  textDecoration: 'none',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  verticalAlign: 'top',
  '&:focus-visible': {
    outline: '2px solid color-mix(in oklab, #101010 35%, white)',
    outlineOffset: '2px',
  },
  '&:disabled, &[aria-disabled="true"]': {
    cursor: 'not-allowed',
    opacity: 0.55,
  },
})

const mediumStyle: CSSMixinDescriptor = css({
  height: '26px',
  minHeight: '26px',
  paddingInline: '12px',
  fontSize: '12px',
  lineHeight: '17px',
  '--rmx-button-neutral-shadow-alpha': '0.03',
})

const largeStyle: CSSMixinDescriptor = css({
  height: '30px',
  minHeight: '30px',
  paddingInline: '12px',
  fontSize: '13px',
  lineHeight: '20px',
  '--rmx-button-neutral-shadow-alpha': '0.04',
})

const neutralStyle: CSSMixinDescriptor = css({
  background: '#FCFCFC',
  border: '1px solid rgba(0, 0, 0, 0.08)',
  boxShadow:
    '0 -2px 0 -2px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(255, 255, 255, 0.75), 0 1px 0 #FFFFFF, 0 2px 4px -1px rgb(0 0 0 / var(--rmx-button-neutral-shadow-alpha)), inset 0 2px 0 #FFFFFF, inset 0 -1px 0 rgba(0, 0, 0, 0.05)',
  color: '#101010',
  textShadow: '0 1px 0 #FFFFFF',
})

const primaryStyle: CSSMixinDescriptor = css({
  background:
    'radial-gradient(50% 50% at 50% 0%, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0) 100%), radial-gradient(49.59% 37.11% at 50.41% 101.56%, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0) 66.46%), #101010',
  border: 0,
  boxShadow:
    '0 16px 16px -8px rgba(0, 0, 0, 0.1), 0 8px 8px -4px rgba(0, 0, 0, 0.1), 0 4px 4px -2px rgba(0, 0, 0, 0.1), 0 2px 2px -1px rgba(0, 0, 0, 0.1), inset 0 0 4px 2px #101010, inset 0 0 4px 2px rgba(255, 255, 255, 0.1), inset 0 0 12px -6px rgba(255, 255, 255, 0.75)',
  color: '#FFFFFF',
  textShadow: '0 1px 1px #000000',
})

const sizeStyles = {
  md: mediumStyle,
  lg: largeStyle,
} as const satisfies Record<ButtonSize, CSSMixinDescriptor>

const toneStyles = {
  neutral: neutralStyle,
  primary: primaryStyle,
} as const satisfies Record<ButtonTone, CSSMixinDescriptor>

export function button(options: ButtonOptions = {}): ButtonMixin {
  let { size = 'md', tone = 'neutral' } = options
  return [buttonDefaultAttrs, baseStyle, sizeStyles[size], toneStyles[tone]]
}

export default button
