import { css } from 'remix/component'
import { theme } from '@remix-run/ui/theme'
let surfaces = [
  ['theme.surface.lvl0', theme.surface.lvl0],
  ['theme.surface.lvl1', theme.surface.lvl1],
  ['theme.surface.lvl2', theme.surface.lvl2],
  ['theme.surface.lvl3', theme.surface.lvl3],
  ['theme.surface.lvl4', theme.surface.lvl4],
] as const

export default function Example() {
  return () => (
    <div mix={stackCss}>
      {surfaces.map(([label, color]) => (
        <div key={label} mix={[swatchCss, css({ backgroundColor: color })]}>
          <code mix={codeCss}>{label}</code>
        </div>
      ))}
    </div>
  )
}

let stackCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
  width: '100%',
})

let swatchCss = css({
  display: 'flex',
  alignItems: 'center',
  minHeight: '48px',
  paddingInline: theme.space.md,
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.md,
})

let codeCss = css({
  fontFamily: theme.fontFamily.mono,
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.secondary,
})
