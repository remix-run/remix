import { css } from 'remix/ui'
import { theme } from '@remix-run/ui/theme'
let sizes = [
  ['theme.control.height.sm', theme.control.height.sm],
  ['theme.control.height.md', theme.control.height.md],
  ['theme.control.height.lg', theme.control.height.lg],
] as const

export default function Example() {
  return () => (
    <div mix={stackCss}>
      {sizes.map(([label, minHeight]) => (
        <div key={label} mix={[sampleCss, css({ minHeight })]}>
          <span mix={labelCss}>{label}</span>
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

let sampleCss = css({
  display: 'inline-flex',
  alignItems: 'center',
  paddingInline: theme.space.md,
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.md,
  backgroundColor: theme.surface.lvl1,
  boxShadow: theme.shadow.xs,
})

let labelCss = css({
  fontFamily: theme.fontFamily.mono,
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.secondary,
})
