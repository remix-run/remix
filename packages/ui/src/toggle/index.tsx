import { createMixin, css } from '@remix-run/ui'
import type { CSSMixinDescriptor, ElementProps, MixinDescriptor } from '@remix-run/ui'
import { renderMixinElement } from '../runtime/mixins/mixin.ts'
import { controlFocusShadow } from '../shared/focus-styles.ts'

export { ToggleChangeEvent, onToggleChange } from '@remix-run/ui/toggle/primitives'

export type ToggleSize = 'md' | 'lg'

export interface ToggleOptions {
  size?: ToggleSize
}

type ToggleMixin = readonly [MixinDescriptor<Element, [], ElementProps>, CSSMixinDescriptor]

const checkedSelector = '&:checked, &[aria-checked="true"], &[data-state="checked"]'
const checkedThumbSelector =
  '&:checked::before, &[aria-checked="true"]::before, &[data-state="checked"]::before'
const uncheckedThumbBackground =
  'linear-gradient(180deg, rgba(0, 0, 0, 0) 33%, rgba(0, 0, 0, 0.04) 100%), #FFFFFF'
const uncheckedThumbShadow =
  '0 0 0 0.5px rgba(0, 0, 0, 0.06), 0 1px 1px -0.5px rgba(0, 0, 0, 0.12), 0 2px 2px -1px rgba(0, 0, 0, 0.12), 0 4px 4px -2px rgba(0, 0, 0, 0.12), inset 0 0 2px 1px #FFFFFF'
const checkedThumbBackground =
  'linear-gradient(180deg, rgba(112, 199, 84, 0) 25%, rgba(112, 199, 84, 0.25) 100%), #FFFFFF'
const checkedThumbShadow =
  '0 1px 2px -0.5px rgba(66, 134, 44, 0.6), 0 2px 4px -1px rgba(66, 134, 44, 0.6), 0 4px 6px -2px rgba(66, 134, 44, 0.6), 0 0 0 0.5px rgba(0, 0, 0, 0.28), inset 0 0 2px 1px #FFFFFF'

const toggleDefaultAttrs = createMixin<Element, [], ElementProps>((handle, hostType) => (props) => {
  if (hostType !== 'input') {
    return handle.element
  }

  let type = props.type ?? 'checkbox'
  if (type !== 'checkbox') {
    return renderMixinElement(handle.element, {
      ...props,
      type,
    })
  }

  return renderMixinElement(handle.element, {
    ...props,
    role: props.role ?? 'switch',
    type,
  })
})()

const baseStyles = {
  appearance: 'none',
  WebkitAppearance: 'none',
  margin: 0,
  boxSizing: 'border-box',
  position: 'relative',
  display: 'inline-block',
  width: 'var(--rmx-toggle-width)',
  height: 'var(--rmx-toggle-height)',
  minWidth: 'var(--rmx-toggle-width)',
  minHeight: 'var(--rmx-toggle-height)',
  padding: 0,
  border: 0,
  borderRadius: '9999px',
  background: 'linear-gradient(180deg, rgba(0, 0, 0, 0.06) 0%, rgba(0, 0, 0, 0) 100%), #EBEBEB',
  boxShadow:
    'inset 0 0 4px 1px rgba(0, 0, 0, 0.08), inset 0 1px 1px rgba(0, 0, 0, 0.02), inset 0 2px 2px rgba(0, 0, 0, 0.02)',
  verticalAlign: 'middle',
  flex: 'none',
  '&::before': {
    content: '""',
    position: 'absolute',
    left: 'var(--rmx-toggle-thumb-inset)',
    top: 'calc((var(--rmx-toggle-height) - var(--rmx-toggle-thumb-height)) / 2)',
    width: 'var(--rmx-toggle-thumb-width)',
    height: 'var(--rmx-toggle-thumb-height)',
    borderRadius: '99px',
    background: uncheckedThumbBackground,
    boxShadow: uncheckedThumbShadow,
    transform: 'translateX(0)',
    transition: 'transform 160ms ease, background 160ms ease, box-shadow 160ms ease',
    pointerEvents: 'none',
  },
  '&:disabled, &[aria-disabled="true"]': {
    opacity: 0.55,
  },
  [checkedSelector]: {
    background: 'linear-gradient(180deg, #70C754 0%, #70C754 100%)',
    boxShadow:
      '0 1px 0 rgba(255, 255, 255, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.4), 0 -4px 8px 2px #FFFFFF, 0 4px 8px 2px rgba(0, 0, 0, 0.05), 0 0 12px 1px rgba(112, 199, 84, 0.25), inset 0 0 4px 1px rgba(0, 0, 0, 0.25), inset 0 1px 1px rgba(0, 0, 0, 0.1), inset 0 2px 2px rgba(0, 0, 0, 0.1)',
  },
  [checkedThumbSelector]: {
    background: checkedThumbBackground,
    boxShadow: checkedThumbShadow,
    transform: 'translateX(var(--rmx-toggle-thumb-translate-x))',
  },
  '&:focus-visible': {
    outline: 0,
    boxShadow: controlFocusShadow,
  },
  '@media (prefers-reduced-motion: reduce)': {
    '&::before': {
      transition: 'none',
    },
  },
}

const thumbTranslate =
  'calc(var(--rmx-toggle-width) - var(--rmx-toggle-thumb-width) - (var(--rmx-toggle-thumb-inset) * 2))'

const sizeStyles = {
  md: css({
    '--rmx-toggle-width': '30px',
    '--rmx-toggle-height': '18px',
    '--rmx-toggle-thumb-width': '18px',
    '--rmx-toggle-thumb-height': '14px',
    '--rmx-toggle-thumb-inset': '2px',
    '--rmx-toggle-thumb-translate-x': thumbTranslate,
    ...baseStyles,
  }),
  lg: css({
    '--rmx-toggle-width': '36px',
    '--rmx-toggle-height': '22px',
    '--rmx-toggle-thumb-width': '22px',
    '--rmx-toggle-thumb-height': '18px',
    '--rmx-toggle-thumb-inset': '2px',
    '--rmx-toggle-thumb-translate-x': thumbTranslate,
    ...baseStyles,
  }),
} as const satisfies Record<ToggleSize, CSSMixinDescriptor>

export function toggle(options: ToggleOptions = {}): ToggleMixin {
  let { size = 'md' } = options
  return [toggleDefaultAttrs, sizeStyles[size]]
}

export default toggle
