import { css } from '@remix-run/ui'
import type { CSSMixinDescriptor } from '@remix-run/ui'
import { controlFocusShadow } from '../shared/focus-styles.ts'
import type { CSSProps } from '../style/style.ts'

export type InputSize = 'md' | 'lg'

export interface InputOptions {
  size?: InputSize
}

type InputMixin = readonly [CSSMixinDescriptor, CSSMixinDescriptor]

interface InputFunction {
  (options?: InputOptions): InputMixin
  root(options?: InputOptions): InputMixin
  field(): CSSMixinDescriptor
}

const frameStyles = {
  '--rmx-input-height': '32px',
  '--rmx-input-padding-block': '6px',
  '--rmx-input-padding-inline': '12px',
  '--rmx-input-root-padding-inline': '8px',
  '--rmx-input-gap': '6px',
  '--rmx-input-icon-size': '16px',
  '--rmx-input-icon-color': '#707070',
  appearance: 'none',
  margin: 0,
  boxSizing: 'border-box',
  display: 'block',
  width: '100%',
  minWidth: 0,
  height: 'var(--rmx-input-height)',
  paddingBlock: 'var(--rmx-input-padding-block)',
  paddingInline: 'var(--rmx-input-padding-inline)',
  border: 0,
  borderRadius: '8px',
  background: '#FFFFFF',
  boxShadow:
    '0 2px 3px -1px rgba(0, 0, 0, 0.04), 0 3px 4px -1.5px rgba(0, 0, 0, 0.04), 0 4px 5px -2px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.12)',
  color: '#101010',
  fontFamily: '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  fontStyle: 'normal',
  fontWeight: 400,
  fontSize: '13px',
  lineHeight: '20px',
  fontFeatureSettings: '"ss01" on, "cv01" on',
  letterSpacing: 0,
  textShadow: '0 1px 0 #FFFFFF',
  '&::placeholder': {
    color: '#B0B0B0',
    opacity: 1,
  },
  '&:disabled, &[aria-disabled="true"]': {
    opacity: 0.55,
  },
} as const satisfies CSSProps

const baseStyle: CSSMixinDescriptor = css({
  ...frameStyles,
  '&[data-touched]:invalid, &[aria-invalid="true"]': {
    background: '#FFF8F6',
    boxShadow:
      '0 2px 3px -1px rgba(0, 0, 0, 0.04), 0 3px 4px -1.5px rgba(0, 0, 0, 0.04), 0 4px 5px -2px rgba(0, 0, 0, 0.04), 0 0 0 1px #FF3000',
  },
  '&:focus-visible': {
    outline: 0,
    boxShadow: controlFocusShadow,
  },
})

const rootBaseStyle: CSSMixinDescriptor = css({
  ...frameStyles,
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--rmx-input-gap)',
  paddingInline: 'var(--rmx-input-root-padding-inline)',
  '&:has(input[data-touched]:invalid), &:has(input[aria-invalid="true"])': {
    background: '#FFF8F6',
    boxShadow:
      '0 2px 3px -1px rgba(0, 0, 0, 0.04), 0 3px 4px -1.5px rgba(0, 0, 0, 0.04), 0 4px 5px -2px rgba(0, 0, 0, 0.04), 0 0 0 1px #FF3000',
  },
  '&:focus-within': {
    boxShadow: controlFocusShadow,
  },
  '&:has(input:disabled), &:has(input[aria-disabled="true"])': {
    opacity: 0.55,
  },
  '& > svg': {
    flex: 'none',
    width: 'var(--rmx-input-icon-size)',
    height: 'var(--rmx-input-icon-size)',
    color: 'var(--rmx-input-icon-color)',
    pointerEvents: 'none',
  },
  '& > button': {
    flex: 'none',
  },
})

const fieldBaseStyle: CSSMixinDescriptor = css({
  appearance: 'none',
  margin: 0,
  boxSizing: 'border-box',
  flex: '1 1 auto',
  minWidth: 0,
  width: '100%',
  height: '20px',
  padding: 0,
  border: 0,
  outline: 0,
  background: 'transparent',
  boxShadow: 'none',
  color: '#101010',
  font: 'inherit',
  fontFeatureSettings: 'inherit',
  letterSpacing: 'inherit',
  textShadow: 'inherit',
  '&::placeholder': {
    color: '#B0B0B0',
    opacity: 1,
  },
  '&:disabled, &[aria-disabled="true"]': {
    opacity: 1,
  },
})

const sizeStyles = {
  md: css({}),
  lg: css({
    '--rmx-input-height': '36px',
    '--rmx-input-padding-block': '8px',
    '--rmx-input-padding-inline': '14px',
    '--rmx-input-root-padding-inline': '10px',
    '--rmx-input-gap': '8px',
    '--rmx-input-icon-size': '18px',
  }),
} as const satisfies Record<InputSize, CSSMixinDescriptor>

function createInput(options: InputOptions = {}): InputMixin {
  let { size = 'md' } = options
  return [baseStyle, sizeStyles[size]]
}

function root(options: InputOptions = {}): InputMixin {
  let { size = 'md' } = options
  return [rootBaseStyle, sizeStyles[size]]
}

function field(): CSSMixinDescriptor {
  return fieldBaseStyle
}

export const input: InputFunction = Object.assign(createInput, { root, field })

export default input
