import { css, on, type Handle } from 'remix/component'
import { Glyph, listbox, theme, ui } from 'remix/ui'

export default function Example(handle: Handle) {
  let selectionSummary = 'value=none values=[] focus=none'

  return () => (
    <div mix={exampleCss}>
      <p mix={helperTextCss}>Space toggles the active option. Enter keeps only the active one.</p>

      <listbox.context multiple>
        <div
          aria-label="Frameworks"
          mix={[
            listbox.list(),
            containerCss,
            on(listbox.change, (event) => {
              selectionSummary = `value=${event.value || 'none'} values=[${event.values.join(', ')}] focus=${event.focusValue || 'none'}`
              void handle.update()
            }),
          ]}
        >
          {frameworkOptions.map((option) => (
            <div key={option.value} mix={[ui.listbox.option, listbox.option(option)]}>
              <Glyph mix={ui.listbox.glyph} name="check" />
              <span mix={ui.listbox.label}>{option.label}</span>
            </div>
          ))}
        </div>
      </listbox.context>

      <p mix={statusCss}>{selectionSummary}</p>
    </div>
  )
}

let frameworkOptions = [
  { label: 'Remix', value: 'remix' },
  { label: 'React', value: 'react' },
  { label: 'Preact', value: 'preact' },
  { disabled: true, label: 'React Router', value: 'react-router' },
  { label: 'Solid', value: 'solid' },
] as const

let exampleCss = css({
  display: 'grid',
  gap: theme.space.xs,
  width: '16rem',
})

let helperTextCss = css({
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
  margin: '0',
})

let containerCss = [
  ui.listbox.surface,
  css({
    border: '1px solid',
    borderColor: theme.colors.border.default,
    padding: theme.space.xs,
    borderRadius: theme.radius.lg,
  }),
]

let statusCss = css({
  color: theme.colors.text.secondary,
  fontFamily: theme.fontFamily.mono,
  fontSize: theme.fontSize.xs,
  margin: '0',
  minHeight: '4rem',
})
