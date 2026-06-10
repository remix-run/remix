import { css, type Handle } from 'remix/ui'
import { theme } from '../../ui/design.ts'

import { Layout } from '../../ui/layout.tsx'

export function HomePage(_handle: Handle) {
  return () => (
    <Layout title="Timeboxer">
      <section mix={heroStyle}>
        <p mix={eyebrowStyle}>Timeboxer</p>
        <h1 mix={titleStyle}>Plan your focused work.</h1>
        <p mix={bodyStyle}>
          Authentication is ready with SQLite users, separate password records, and session-backed
          sign-in.
        </p>
      </section>
    </Layout>
  )
}

const heroStyle = css({
  margin: '0 auto',
  maxWidth: '760px',
  padding: `32px ${theme.space.xl}`,
})

const eyebrowStyle = css({
  color: theme.colors.text.muted,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  letterSpacing: theme.letterSpacing.wide,
  textTransform: 'uppercase',
})

const titleStyle = css({
  color: theme.colors.text.primary,
  fontSize: theme.fontSize.xxl,
  letterSpacing: theme.letterSpacing.tight,
  lineHeight: theme.lineHeight.tight,
  margin: 0,
})

const bodyStyle = css({
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.md,
  lineHeight: theme.lineHeight.relaxed,
  maxWidth: '560px',
})
