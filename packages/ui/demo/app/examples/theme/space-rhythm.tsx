import { css } from 'remix/component'
import { theme } from 'remix/ui'

let gaps = [
  ['theme.space.xs', theme.space.xs],
  ['theme.space.sm', theme.space.sm],
  ['theme.space.md', theme.space.md],
  ['theme.space.lg', theme.space.lg],
] as const

export default function Example() {
  return () => (
    <div mix={stackCss}>
      {gaps.map(([label, gap]) => (
        <div key={label} mix={rowWrapperCss}>
          <p mix={labelCss}>{label}</p>
          <div mix={[rowCss, css({ gap })]}>
            <span mix={dotCss} />
            <span mix={dotCss} />
            <span mix={dotCss} />
          </div>
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

let rowWrapperCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
})

let labelCss = css({
  margin: 0,
  fontFamily: theme.fontFamily.mono,
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.secondary,
})

let rowCss = css({
  display: 'flex',
  alignItems: 'center',
  padding: theme.space.sm,
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.md,
  backgroundColor: theme.surface.lvl1,
})

let dotCss = css({
  width: '18px',
  height: '18px',
  borderRadius: theme.radius.full,
  backgroundColor: theme.colors.text.link,
})
