import { css } from '@remix-run/ui'
import type { Handle, RemixNode } from '@remix-run/ui'
import * as checkbox from '@remix-run/ui/checkbox/primitives'
import { controlFocusShadow } from '../shared/focus-styles.ts'

/**
 * @name Checkbox Primitives
 * @description Headless checkbox behavior with minimal local styles.
 * @layout center
 */
export default function Example() {
  return () => (
    <div mix={checkboxDemoCss}>
      <section mix={sectionCss}>
        <h2 mix={sectionLabelCss}>Standalone primitive</h2>
        <div mix={stackCss}>
          <PrimitiveCheckbox label="Unchecked" />
          <PrimitiveCheckbox defaultChecked label="Checked" />
          <PrimitiveCheckbox defaultChecked="mixed" label="Mixed" />
          <PrimitiveCheckbox defaultChecked="mixed" disabled label="Disabled mixed" />
        </div>
      </section>

      <section mix={sectionCss}>
        <h2 mix={sectionLabelCss}>Group primitive</h2>
        <PrimitiveCheckboxGroup
          defaultValue={['read', 'write']}
          label="Permission primitives"
          name="permissions"
        >
          <PrimitiveGroupParent label="All permissions" />
          <div mix={nestedOptionsCss}>
            <PrimitiveGroupItem label="Read" value="read" />
            <PrimitiveGroupItem label="Write" value="write" />
            <PrimitiveGroupItem label="Deploy" value="deploy" />
            <PrimitiveGroupItem disabled label="Billing" value="billing" />
          </div>
        </PrimitiveCheckboxGroup>
      </section>
    </div>
  )
}

interface PrimitiveCheckboxProps extends checkbox.CheckboxControlOptions {
  label: string
}

function PrimitiveCheckbox(handle: Handle<PrimitiveCheckboxProps>): () => RemixNode {
  return () => {
    let { label, ...controlProps } = handle.props

    return (
      <label mix={optionCss}>
        <input aria-label={label} mix={[controlCss, checkbox.control(controlProps)]} />
        <span>{label}</span>
      </label>
    )
  }
}

interface PrimitiveCheckboxGroupProps extends Omit<checkbox.CheckboxGroupContextProps, 'children'> {
  children?: RemixNode
  label: string
}

function PrimitiveCheckboxGroup(handle: Handle<PrimitiveCheckboxGroupProps>): () => RemixNode {
  return () => {
    let { children, label, ...contextProps } = handle.props

    return (
      <checkbox.GroupContext {...contextProps}>
        <div aria-label={label} mix={[groupCss, checkbox.group()]}>
          {children}
        </div>
      </checkbox.GroupContext>
    )
  }
}

interface PrimitiveGroupParentProps extends checkbox.CheckboxParentOptions {
  label: string
}

function PrimitiveGroupParent(handle: Handle<PrimitiveGroupParentProps>): () => RemixNode {
  return () => {
    let { label, ...contextProps } = handle.props

    return (
      <label mix={optionCss}>
        <input aria-label={label} mix={[controlCss, checkbox.parent(contextProps)]} />
        <span>{label}</span>
      </label>
    )
  }
}

interface PrimitiveGroupItemProps extends checkbox.CheckboxItemOptions {
  label: string
}

function PrimitiveGroupItem(handle: Handle<PrimitiveGroupItemProps>): () => RemixNode {
  return () => {
    let { label, ...contextProps } = handle.props

    return (
      <label mix={optionCss}>
        <input aria-label={label} mix={[controlCss, checkbox.item(contextProps)]} />
        <span>{label}</span>
      </label>
    )
  }
}

const checkboxDemoCss = css({
  display: 'grid',
  gap: '28px',
  width: 'min(100%, 20rem)',
})

const sectionCss = css({
  display: 'grid',
  gap: '12px',
})

const sectionLabelCss = css({
  margin: 0,
  fontFamily: '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  fontSize: '12px',
  lineHeight: '16px',
  fontWeight: 650,
  letterSpacing: 0,
  color: 'rgba(16, 16, 16, 0.72)',
})

const stackCss = css({
  display: 'grid',
  gap: '8px',
})

const groupCss = css({
  display: 'grid',
  gap: '8px',
})

const controlCss = css({
  appearance: 'none',
  WebkitAppearance: 'none',
  display: 'inline-grid',
  placeItems: 'center',
  width: '16px',
  height: '16px',
  margin: 0,
  boxSizing: 'border-box',
  position: 'relative',
  border: '1px solid #b8b8b8',
  borderRadius: '4px',
  background: '#ffffff',
  color: '#ffffff',
  flex: 'none',
  '&[data-state="checked"], &[data-state="mixed"]': {
    borderColor: '#3573f6',
    background: '#3573f6',
  },
  '&[data-state="checked"]::after': {
    content: '"✓"',
    fontSize: '12px',
    lineHeight: '12px',
  },
  '&[data-state="mixed"]::after': {
    content: '""',
    width: '8px',
    height: '2px',
    borderRadius: '999px',
    background: '#ffffff',
  },
  '&:focus-visible': {
    outline: 0,
    boxShadow: controlFocusShadow,
  },
  '&[aria-disabled="true"]': {
    opacity: 0.5,
  },
})

const optionCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  minHeight: '28px',
  fontFamily: '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  fontSize: '13px',
  lineHeight: '18px',
  fontWeight: 500,
  letterSpacing: 0,
  color: '#101010',
})

const nestedOptionsCss = css({
  display: 'grid',
  gap: '6px',
  paddingLeft: '24px',
})
