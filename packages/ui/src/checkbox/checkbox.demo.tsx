import { css, on } from '@remix-run/ui'
import type { Handle } from '@remix-run/ui'
import checkbox, { type CheckboxState } from '@remix-run/ui/checkbox'

/**
 * @name Checkbox Basic
 * @description The checkbox mixin applies small or large checkbox styling to native inputs.
 * @layout center
 */
export default function Example() {
  return () => (
    <div mix={checkboxDemoCss}>
      <section mix={sectionCss}>
        <h2 mix={sectionLabelCss}>Styled input mixin</h2>
        <div mix={headerCss}>
          <span />
          <span mix={labelCss}>Medium</span>
          <span mix={labelCss}>Large</span>
          <span mix={labelCss}>Disabled md</span>
          <span mix={labelCss}>Disabled lg</span>
        </div>

        <div mix={rowCss}>
          <span mix={stateLabelCss}>Unchecked</span>
          <input aria-label="Unchecked medium" mix={checkbox()} />
          <input aria-label="Unchecked large" mix={checkbox({ size: 'lg' })} />
          <input aria-label="Unchecked medium disabled" disabled mix={checkbox()} />
          <input aria-label="Unchecked large disabled" disabled mix={checkbox({ size: 'lg' })} />
        </div>

        <div mix={rowCss}>
          <span mix={stateLabelCss}>Checked</span>
          <input aria-label="Checked medium" defaultChecked mix={checkbox()} />
          <input aria-label="Checked large" defaultChecked mix={checkbox({ size: 'lg' })} />
          <input aria-label="Checked medium disabled" defaultChecked disabled mix={checkbox()} />
          <input
            aria-label="Checked large disabled"
            defaultChecked
            disabled
            mix={checkbox({ size: 'lg' })}
          />
        </div>

        <div mix={rowCss}>
          <span mix={stateLabelCss}>Mixed</span>
          <input aria-label="Mixed medium" indeterminate mix={checkbox({ state: 'mixed' })} />
          <input
            aria-label="Mixed large"
            indeterminate
            mix={checkbox({ size: 'lg', state: 'mixed' })}
          />
          <input
            aria-label="Mixed medium disabled"
            disabled
            indeterminate
            mix={checkbox({ state: 'mixed' })}
          />
          <input
            aria-label="Mixed large disabled"
            disabled
            indeterminate
            mix={checkbox({ size: 'lg', state: 'mixed' })}
          />
        </div>
      </section>

      <section mix={sectionCss}>
        <h2 mix={sectionLabelCss}>Group state in app code</h2>
        <PermissionsGroup />
      </section>
    </div>
  )
}

type PermissionValue = (typeof permissionItems)[number]['value']

const permissionItems = [
  { label: 'Read', value: 'read' },
  { label: 'Write', value: 'write' },
  { label: 'Deploy', value: 'deploy' },
] as const

function PermissionsGroup(handle: Handle) {
  let selectedPermissions = new Set<PermissionValue>(['read', 'write'])

  function getParentState(): CheckboxState {
    if (selectedPermissions.size === 0) {
      return 'unchecked'
    }

    return permissionItems.every((item) => selectedPermissions.has(item.value))
      ? 'checked'
      : 'mixed'
  }

  function setSelectedPermissions(nextSelectedPermissions: Set<PermissionValue>) {
    selectedPermissions = nextSelectedPermissions
    void handle.update()
  }

  return () => {
    let parentState = getParentState()

    return (
      <fieldset aria-labelledby="permissions-label" mix={groupCss}>
        <legend id="permissions-label" mix={stateLabelCss}>
          Permissions
        </legend>
        <label mix={optionCss}>
          <input
            checked={parentState === 'checked'}
            indeterminate={parentState === 'mixed'}
            mix={[
              checkbox({ state: parentState }),
              on('change', (event) => {
                setSelectedPermissions(
                  event.currentTarget.checked
                    ? new Set(permissionItems.map((item) => item.value))
                    : new Set<PermissionValue>(),
                )
              }),
            ]}
          />
          All permissions
        </label>
        <div mix={nestedOptionsCss}>
          {permissionItems.map((item) => (
            <label key={item.value} mix={optionCss}>
              <input
                checked={selectedPermissions.has(item.value)}
                mix={[
                  checkbox(),
                  on('change', (event) => {
                    let nextSelectedPermissions = new Set(selectedPermissions)

                    if (event.currentTarget.checked) {
                      nextSelectedPermissions.add(item.value)
                    } else {
                      nextSelectedPermissions.delete(item.value)
                    }

                    setSelectedPermissions(nextSelectedPermissions)
                  }),
                ]}
                name="permissions"
                value={item.value}
              />
              {item.label}
            </label>
          ))}
        </div>
      </fieldset>
    )
  }
}

const checkboxDemoCss = css({
  display: 'grid',
  gap: '28px',
  width: 'min(100%, 34rem)',
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

const headerCss = css({
  display: 'grid',
  gridTemplateColumns: '6.5rem repeat(4, minmax(4.25rem, 1fr))',
  alignItems: 'end',
  gap: '14px',
})

const rowCss = css({
  display: 'grid',
  gridTemplateColumns: '6.5rem repeat(4, minmax(4.25rem, 1fr))',
  alignItems: 'center',
  gap: '14px',
  minHeight: '32px',
})

const labelCss = css({
  fontFamily: '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  fontSize: '11px',
  lineHeight: '14px',
  fontWeight: 600,
  letterSpacing: 0,
  color: 'rgba(16, 16, 16, 0.58)',
})

const stateLabelCss = css({
  fontFamily: '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  fontSize: '13px',
  lineHeight: '18px',
  fontWeight: 600,
  letterSpacing: 0,
  color: '#101010',
})

const groupCss = css({
  display: 'grid',
  gap: '8px',
  margin: 0,
  padding: 0,
  border: 0,
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
