import { css, on, type Handle } from 'remix/component'
import { Glyph, listbox, theme, ui } from 'remix/ui'

export default function Example() {
  return () => (
    <listbox.context>
      <div aria-label="Frameworks" mix={[listbox.list(), ui.listbox.surface, containerCss]}>
        {frameworkOptions.map((option) => (
          <div key={option.value} mix={[ui.listbox.option, listbox.option(option)]}>
            <Glyph mix={ui.listbox.glyph} name="check" />
            <span mix={ui.listbox.label}>{option.label}</span>
          </div>
        ))}
      </div>
    </listbox.context>
  )
}

let frameworkOptions = [
  { label: 'Remix', value: 'remix' },
  { label: 'React', value: 'react' },
  { label: 'Preact', value: 'preact' },
  { disabled: true, label: 'React Router', value: 'react-router' },
  { label: 'Solid', value: 'solid' },
] as const

let containerCss = css({
  border: '1px solid',
  borderColor: theme.colors.border.default,
  padding: theme.space.xs,
  borderRadius: theme.radius.lg,
  '&:focus': {
    outline: `2px solid ${theme.colors.focus.ring}`,
  },
})
