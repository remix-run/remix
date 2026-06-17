import { css, ref } from '@remix-run/ui'
import checkbox, {
  Checkbox,
  CheckboxGroup,
  CheckboxGroupParent,
  CheckboxItem,
} from '@remix-run/ui/components/checkbox'

/**
 * @name Checkbox Basic
 * @description Native checkbox styling and mixed-state checkbox components.
 * @layout center
 */
export default function Example() {
  return () => (
    <div mix={checkboxDemoCss}>
      <section mix={sectionCss}>
        <h2 mix={sectionLabelCss}>Native input mixin</h2>
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
          <input aria-label="Checked medium" checked mix={checkbox()} readOnly />
          <input aria-label="Checked large" checked mix={checkbox({ size: 'lg' })} readOnly />
          <input aria-label="Checked medium disabled" checked disabled mix={checkbox()} readOnly />
          <input
            aria-label="Checked large disabled"
            checked
            disabled
            mix={checkbox({ size: 'lg' })}
            readOnly
          />
        </div>

        <div mix={rowCss}>
          <span mix={stateLabelCss}>Mixed</span>
          <input
            aria-label="Mixed medium"
            data-state="mixed"
            mix={[checkbox(), indeterminateInput]}
          />
          <input
            aria-label="Mixed large"
            data-state="mixed"
            mix={[checkbox({ size: 'lg' }), indeterminateInput]}
          />
          <input
            aria-label="Mixed medium disabled"
            data-state="mixed"
            disabled
            mix={[checkbox(), indeterminateInput]}
          />
          <input
            aria-label="Mixed large disabled"
            data-state="mixed"
            disabled
            mix={[checkbox({ size: 'lg' }), indeterminateInput]}
          />
        </div>
      </section>

      <section mix={sectionCss}>
        <h2 mix={sectionLabelCss}>Component</h2>
        <div mix={headerCss}>
          <span />
          <span mix={labelCss}>Medium</span>
          <span mix={labelCss}>Large</span>
          <span mix={labelCss}>Disabled md</span>
          <span mix={labelCss}>Disabled lg</span>
        </div>

        <div mix={rowCss}>
          <span mix={stateLabelCss}>Unchecked</span>
          <Checkbox aria-label="Component unchecked medium" />
          <Checkbox aria-label="Component unchecked large" size="lg" />
          <Checkbox aria-label="Component unchecked medium disabled" disabled />
          <Checkbox aria-label="Component unchecked large disabled" disabled size="lg" />
        </div>

        <div mix={rowCss}>
          <span mix={stateLabelCss}>Checked</span>
          <Checkbox aria-label="Component checked medium" defaultChecked />
          <Checkbox aria-label="Component checked large" defaultChecked size="lg" />
          <Checkbox aria-label="Component checked medium disabled" defaultChecked disabled />
          <Checkbox
            aria-label="Component checked large disabled"
            defaultChecked
            disabled
            size="lg"
          />
        </div>

        <div mix={rowCss}>
          <span mix={stateLabelCss}>Mixed</span>
          <Checkbox aria-label="Component mixed medium" defaultChecked="mixed" />
          <Checkbox aria-label="Component mixed large" defaultChecked="mixed" size="lg" />
          <Checkbox aria-label="Component mixed medium disabled" defaultChecked="mixed" disabled />
          <Checkbox
            aria-label="Component mixed large disabled"
            defaultChecked="mixed"
            disabled
            size="lg"
          />
        </div>
      </section>

      <section mix={sectionCss}>
        <h2 mix={sectionLabelCss}>Group component</h2>
        <CheckboxGroup aria-labelledby="permissions-label" defaultValue={['read', 'write']}>
          <div id="permissions-label" mix={stateLabelCss}>
            Permissions
          </div>
          <label mix={optionCss}>
            <CheckboxGroupParent aria-label="All permissions" />
            All permissions
          </label>
          <div mix={nestedOptionsCss}>
            <label mix={optionCss}>
              <CheckboxItem value="read" />
              Read
            </label>
            <label mix={optionCss}>
              <CheckboxItem value="write" />
              Write
            </label>
            <label mix={optionCss}>
              <CheckboxItem value="deploy" />
              Deploy
            </label>
          </div>
        </CheckboxGroup>
      </section>
    </div>
  )
}

const indeterminateInput = ref((node: HTMLInputElement) => {
  node.indeterminate = true
})

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
