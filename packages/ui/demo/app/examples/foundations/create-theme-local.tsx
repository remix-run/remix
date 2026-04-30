import { css } from 'remix/ui'
import { Button } from '@remix-run/ui/button'
import { Glyph } from '@remix-run/ui/glyph'
import { createTheme, theme } from '@remix-run/ui/theme'
let MeadowTheme = createTheme(
  {
    space: {
      none: '0px',
      px: '1px',
      xs: '4px',
      sm: '8px',
      md: '12px',
      lg: '16px',
      xl: '24px',
      xxl: '32px',
    },
    radius: {
      none: '0px',
      sm: '4px',
      md: '10px',
      lg: '18px',
      xl: '24px',
      full: '9999px',
    },
    fontSize: {
      xxxs: '10px',
      xxs: '11px',
      xs: '12px',
      sm: '13px',
      md: '14px',
      lg: '16px',
      xl: '20px',
      xxl: '28px',
    },
    fontFamily: {
      sans: '"Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    },
    lineHeight: {
      tight: '1.25',
      normal: '1.45',
      relaxed: '1.65',
    },
    letterSpacing: {
      tight: '-0.03em',
      normal: '0',
      meta: '0.06em',
      wide: '0.08em',
    },
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
    control: {
      height: {
        sm: '28px',
        md: '32px',
        lg: '36px',
      },
    },
    surface: {
      lvl0: '#f8fff6',
      lvl1: '#eef9ea',
      lvl2: '#e5f3de',
      lvl3: '#d7ebce',
      lvl4: '#c9e2bf',
    },
    shadow: {
      xs: '0 1px 1px rgb(0 0 0 / 0.05)',
      sm: '0 1px 2px rgb(0 0 0 / 0.07)',
      md: '0 6px 18px rgb(0 0 0 / 0.08)',
      lg: '0 16px 34px rgb(0 0 0 / 0.10)',
      xl: '0 24px 52px rgb(0 0 0 / 0.14)',
    },
    colors: {
      text: {
        primary: '#17321a',
        secondary: '#39513d',
        muted: '#5d7860',
        link: '#1f7a3d',
      },
      border: {
        subtle: '#c9ddc5',
        default: '#acc7a7',
        strong: '#b0b0b0',
      },
      focus: {
        ring: '#2a8a49',
      },
      overlay: {
        scrim: 'rgb(0 0 0 / 0.28)',
      },
      action: {
        primary: {
          background: '#2a8a49',
          backgroundHover: '#24763f',
          backgroundActive: '#1e6435',
          foreground: '#f7fff8',
          border: '#2a8a49',
        },
        secondary: {
          background: '#fbfff9',
          backgroundHover: '#f3fbef',
          backgroundActive: '#ebf6e6',
          foreground: '#17321a',
          border: '#acc7a7',
        },
        danger: {
          background: '#FF3000',
          backgroundHover: '#e12b00',
          backgroundActive: '#c52600',
          foreground: 'rgb(255 255 255 / 0.92)',
          border: '#FF3000',
        },
      },
    },
  },
  {
    reset: false,
    selector: '[data-create-theme-local]',
  },
)

export default function Example() {
  return () => (
    <>
      <MeadowTheme />
      <section data-create-theme-local="" mix={frameCss}>
        <article mix={[panelCss, previewCardCss]}>
          <div mix={panelHeaderCss}>
            <p mix={eyebrowCss}>createTheme()</p>
            <h3 mix={titleCss}>Scoped theme preview</h3>
            <p mix={bodyCss}>
              The same `theme` values and styling namespaces now resolve against a locally scoped
              theme.
            </p>
          </div>
          <div mix={statsRowCss}>
            <div mix={[statCardCss, statCardSurfaceCss]}>
              <p mix={statLabelCss}>Surface</p>
              <p mix={statValueCss}>theme.surface.lvl0</p>
            </div>
            <div mix={[statCardCss, statCardSurfaceCss]}>
              <p mix={statLabelCss}>Primary</p>
              <p mix={statValueCss}>button.primaryStyle</p>
            </div>
          </div>
          <div mix={actionRowCss}>
            <Button tone="secondary">Preview</Button>
            <Button startIcon={<Glyph name="add" />} tone="primary">
              Ship theme
            </Button>
          </div>
        </article>
      </section>
    </>
  )
}

let frameCss = css({
  width: '100%',
  padding: theme.space.md,
  borderRadius: theme.radius.xl,
  backgroundColor: theme.surface.lvl2,
})

let panelCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.md,
  padding: theme.space.lg,
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.lg,
  backgroundColor: theme.surface.lvl0,
  boxShadow: theme.shadow.xs,
})

let panelHeaderCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
})

let previewCardCss = css({
  minHeight: '100%',
})

let eyebrowCss = css({
  margin: 0,
  fontSize: theme.fontSize.xxxs,
  fontWeight: theme.fontWeight.semibold,
  letterSpacing: theme.letterSpacing.meta,
  textTransform: 'uppercase',
  color: theme.colors.text.muted,
})

let titleCss = css({
  margin: 0,
  fontSize: theme.fontSize.lg,
  lineHeight: theme.lineHeight.tight,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})

let bodyCss = css({
  margin: 0,
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.relaxed,
  color: theme.colors.text.secondary,
})

let statsRowCss = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: theme.space.sm,
})

let statCardCss = css({
  gap: theme.space.xs,
  padding: theme.space.md,
})

let statCardSurfaceCss = css({
  display: 'flex',
  flexDirection: 'column',
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.md,
  backgroundColor: theme.surface.lvl1,
})

let statLabelCss = css({
  margin: 0,
  fontSize: theme.fontSize.xxxs,
  fontWeight: theme.fontWeight.semibold,
  letterSpacing: theme.letterSpacing.meta,
  textTransform: 'uppercase',
  color: theme.colors.text.muted,
})

let statValueCss = css({
  margin: 0,
  fontFamily: theme.fontFamily.mono,
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.primary,
})

let actionRowCss = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space.sm,
})
