import { css } from 'remix/component'
import { theme } from '@remix-run/ui/theme'
export default function Example() {
  return () => (
    <div mix={stackCss}>
      <p mix={[sampleCss, css({ fontSize: theme.fontSize.xxs })]}>xxs label</p>
      <p mix={[sampleCss, css({ fontSize: theme.fontSize.sm })]}>sm body copy</p>
      <p
        mix={[
          sampleCss,
          css({
            fontSize: theme.fontSize.lg,
            fontWeight: theme.fontWeight.semibold,
            lineHeight: theme.lineHeight.tight,
          }),
        ]}
      >
        lg title
      </p>
      <code
        mix={[
          sampleCss,
          css({
            fontFamily: theme.fontFamily.mono,
            fontSize: theme.fontSize.xs,
            letterSpacing: theme.letterSpacing.normal,
          }),
        ]}
      >
        theme.fontFamily.mono
      </code>
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
  margin: 0,
  fontFamily: theme.fontFamily.sans,
  color: theme.colors.text.primary,
  letterSpacing: theme.letterSpacing.tight,
})
