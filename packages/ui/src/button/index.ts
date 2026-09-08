import { createMixin, css } from '@remix-run/ui'
import type { CSSMixinDescriptor, ElementProps, MixinDescriptor } from '@remix-run/ui'
import { renderMixinElement } from '../runtime/mixins/mixin.ts'

export type ButtonSize = 'md' | 'lg'
export type ButtonTone = 'neutral' | 'primary' | 'ghost'

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

const buttonDefaultAttrs = createMixin<Element, [], ElementProps>((handle, hostType) => (props) => {
  if (hostType !== 'button' || props.type !== undefined) {
    return handle.element
  }

  return renderMixinElement(handle.element, {
    ...props,
    type: 'button',
  })
})()

const baseStyle: CSSMixinDescriptor = css({
  '--rmx-button-shadow': '0 0 0 0 rgba(0, 0, 0, 0)',
  '--rmx-button-focus-shadow':
    '0 0 0 1px light-dark(#3573F6, #6eaaff), var(--rmx-button-shadow), 0 0 0 4px light-dark(rgba(53, 115, 246, 0.1), rgba(110, 170, 255, 0.18)), 0 6px 32px 4px light-dark(rgba(53, 115, 246, 0.08), rgba(110, 170, 255, 0.14)), inset 0 0 8px 1px light-dark(rgba(53, 115, 246, 0.05), rgba(110, 170, 255, 0.1))',
  appearance: 'none',
  margin: 0,
  boxSizing: 'border-box',
  cursor: 'revert',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'row',
  gap: '4px',
  paddingBlock: 0,
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
  boxShadow: 'var(--rmx-button-shadow)',
  '&:focus-visible': {
    outline: 0,
    boxShadow: 'var(--rmx-button-focus-shadow)',
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
  background: 'light-dark(#FCFCFC, #232323)',
  border: '1px solid light-dark(rgba(0, 0, 0, 0.08), rgba(255, 255, 255, 0.14))',
  '--rmx-button-shadow':
    '0 -2px 0 -2px rgba(0, 0, 0, 0.06), 0 0 0 1px light-dark(rgba(255, 255, 255, 0.75), rgba(255, 255, 255, 0.08)), 0 1px 0 light-dark(#FFFFFF, rgba(255, 255, 255, 0.04)), 0 2px 4px -1px rgb(0 0 0 / var(--rmx-button-neutral-shadow-alpha)), inset 0 2px 0 light-dark(#FFFFFF, rgba(255, 255, 255, 0.08)), inset 0 -1px 0 rgba(0, 0, 0, 0.05)',
  color: 'light-dark(#101010, #ececec)',
  textShadow: '0 1px 0 light-dark(#FFFFFF, rgb(0 0 0 / 0.35))',
  '&:hover:not(:disabled):not([aria-disabled="true"])': {
    background: 'light-dark(#FFFFFF, #272727)',
    borderColor: 'light-dark(rgba(0, 0, 0, 0.1), rgba(255, 255, 255, 0.18))',
    '--rmx-button-shadow':
      '0 -2px 0 -2px rgba(0, 0, 0, 0.06), 0 0 0 1px light-dark(rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.1)), 0 1px 0 light-dark(#FFFFFF, rgba(255, 255, 255, 0.05)), 0 3px 6px -2px rgb(0 0 0 / calc(var(--rmx-button-neutral-shadow-alpha) + 0.03)), inset 0 2px 0 light-dark(#FFFFFF, rgba(255, 255, 255, 0.1)), inset 0 -1px 0 rgba(0, 0, 0, 0.05)',
  },
  '&:active:not(:disabled):not([aria-disabled="true"]), &[aria-pressed="true"]:not(:disabled):not([aria-disabled="true"])':
    {
      background: 'light-dark(#F7F7F7, #1f1f1f)',
      borderColor: 'light-dark(rgba(0, 0, 0, 0.12), rgba(255, 255, 255, 0.2))',
      '--rmx-button-shadow':
        '0 0 0 1px light-dark(rgba(255, 255, 255, 0.65), rgba(255, 255, 255, 0.08)), inset 0 1px 2px rgba(0, 0, 0, 0.12), inset 0 -1px 0 light-dark(rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.05))',
      textShadow: 'none',
    },
})

const primaryStyle: CSSMixinDescriptor = css({
  background:
    'radial-gradient(50% 50% at 50% 0%, light-dark(rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.65)) 0%, rgba(255, 255, 255, 0) 100%), radial-gradient(49.59% 37.11% at 50.41% 101.56%, light-dark(rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.35)) 0%, rgba(255, 255, 255, 0) 66.46%), light-dark(#101010, #ececec)',
  border: 0,
  '--rmx-button-shadow':
    '0 16px 16px -8px rgba(0, 0, 0, 0.1), 0 8px 8px -4px rgba(0, 0, 0, 0.1), 0 4px 4px -2px rgba(0, 0, 0, 0.1), 0 2px 2px -1px rgba(0, 0, 0, 0.1), inset 0 0 4px 2px light-dark(#101010, rgba(255, 255, 255, 0.45)), inset 0 0 4px 2px rgba(255, 255, 255, 0.1), inset 0 0 12px -6px rgba(255, 255, 255, 0.75)',
  color: 'light-dark(#FFFFFF, #151515)',
  textShadow: '0 1px 1px light-dark(#000000, rgb(255 255 255 / 0.45))',
  '&:hover:not(:disabled):not([aria-disabled="true"])': {
    background:
      'radial-gradient(50% 50% at 50% 0%, light-dark(rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0.72)) 0%, rgba(255, 255, 255, 0) 100%), radial-gradient(49.59% 37.11% at 50.41% 101.56%, light-dark(rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.42)) 0%, rgba(255, 255, 255, 0) 66.46%), light-dark(#171717, #ffffff)',
    '--rmx-button-shadow':
      '0 18px 18px -10px rgba(0, 0, 0, 0.14), 0 8px 8px -4px rgba(0, 0, 0, 0.12), 0 4px 4px -2px rgba(0, 0, 0, 0.1), 0 2px 2px -1px rgba(0, 0, 0, 0.1), inset 0 0 4px 2px light-dark(#101010, rgba(255, 255, 255, 0.5)), inset 0 0 4px 2px rgba(255, 255, 255, 0.13), inset 0 0 12px -6px rgba(255, 255, 255, 0.85)',
  },
  '&:active:not(:disabled):not([aria-disabled="true"]), &[aria-pressed="true"]:not(:disabled):not([aria-disabled="true"])':
    {
      background:
        'radial-gradient(50% 50% at 50% 0%, light-dark(rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.45)) 0%, rgba(255, 255, 255, 0) 100%), radial-gradient(49.59% 37.11% at 50.41% 101.56%, light-dark(rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.28)) 0%, rgba(255, 255, 255, 0) 66.46%), light-dark(#080808, #d9d9d9)',
      '--rmx-button-shadow':
        '0 2px 2px -1px rgba(0, 0, 0, 0.14), inset 0 0 4px 2px light-dark(#050505, rgba(255, 255, 255, 0.35)), inset 0 1px 2px rgba(0, 0, 0, 0.45), inset 0 0 10px -6px rgba(255, 255, 255, 0.55)',
      textShadow: '0 1px 1px light-dark(#000000, rgb(255 255 255 / 0.35))',
    },
  '&:active:not(:disabled):not([aria-disabled="true"])': {
    transform: 'translateY(1px)',
  },
})

const ghostStyle: CSSMixinDescriptor = css({
  background: 'transparent',
  border: '1px solid transparent',
  '--rmx-button-shadow': '0 0 0 0 rgba(0, 0, 0, 0)',
  color: 'light-dark(#101010, #ececec)',
  textShadow: 'none',
  '&:hover:not(:disabled):not([aria-disabled="true"])': {
    background: 'light-dark(rgba(16, 16, 16, 0.05), rgba(236, 236, 236, 0.1))',
  },
  '&:active:not(:disabled):not([aria-disabled="true"]), &[aria-pressed="true"]:not(:disabled):not([aria-disabled="true"])':
    {
      background: 'light-dark(rgba(16, 16, 16, 0.08), rgba(236, 236, 236, 0.14))',
    },
})

const sizeStyles = {
  md: mediumStyle,
  lg: largeStyle,
} as const satisfies Record<ButtonSize, CSSMixinDescriptor>

const toneStyles = {
  neutral: neutralStyle,
  primary: primaryStyle,
  ghost: ghostStyle,
} as const satisfies Record<ButtonTone, CSSMixinDescriptor>

export function button(options: ButtonOptions = {}): ButtonMixin {
  let { size = 'md', tone = 'neutral' } = options
  return [buttonDefaultAttrs, baseStyle, sizeStyles[size], toneStyles[tone]]
}

export default button
