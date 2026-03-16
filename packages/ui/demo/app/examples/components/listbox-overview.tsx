import { css } from 'remix/component'
import { Glyph, Listbox, theme, ui } from 'remix/ui'

let listboxExampleCss = css({
  width: '16rem',
})

let listboxAnchorCss = css({
  width: '100%',
})

let comparisonCss = css({
  display: 'grid',
  gap: theme.space.md,
  width: '16rem',
})

let nativeSelectCss = css({
  minHeight: theme.control.height.md,
  paddingInline: theme.space.sm,
  borderRadius: theme.radius.md,
  border: `1px solid ${theme.colors.border.standard}`,
  backgroundColor: theme.colors.background.panel,
  color: theme.colors.text.primary,
  fontFamily: theme.fontFamily.sans,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.normal,
})

export default function example() {
  return () => (
    <div mix={comparisonCss}>
      <Listbox
        defaultValue="staging"
        defaultLabel="Choose an environment"
        mix={[ui.listbox.root, listboxExampleCss]}
        name="environment"
        setup={{ label: 'Staging' }}
      >
        <div mix={[ui.listbox.anchor, listboxAnchorCss]}>
          <button mix={ui.listbox.trigger}>
            <span mix={ui.listbox.value}>Choose an environment</span>
            <Glyph mix={ui.listbox.indicator} name="chevronDown" />
          </button>
        </div>

        <div mix={ui.listbox.popup}>
          <div mix={ui.listbox.list}>
            <div mix={ui.listbox.item('local', { textValue: 'Local' })}>
              <Glyph mix={ui.listbox.itemIndicator} name="check" />
              <span mix={ui.listbox.itemLabel}>Local</span>
            </div>
            <div mix={ui.listbox.item('staging', { textValue: 'Staging' })}>
              <Glyph mix={ui.listbox.itemIndicator} name="check" />
              <span mix={ui.listbox.itemLabel}>Staging</span>
            </div>
            <div mix={ui.listbox.item('production', { textValue: 'Production' })}>
              <Glyph mix={ui.listbox.itemIndicator} name="check" />
              <span mix={ui.listbox.itemLabel}>Production</span>
            </div>
            <div mix={ui.listbox.item('archived', { disabled: true, textValue: 'Archived' })}>
              <Glyph mix={ui.listbox.itemIndicator} name="check" />
              <span mix={ui.listbox.itemLabel}>Archived</span>
            </div>
          </div>
        </div>
      </Listbox>

      <select mix={nativeSelectCss} name="native-environment">
        <option>Choose an environment</option>
        <option>Local</option>
        <option selected>Staging</option>
        <option>Production</option>
        <option disabled>Archived</option>
      </select>
    </div>
  )
}
