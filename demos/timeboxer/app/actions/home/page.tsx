import { css, type Handle } from 'remix/component'
import { theme } from '../../ui/public/design.ts'

import { Layout } from '../../ui/layout.tsx'

export function HomePage(_handle: Handle) {
  return () => (
    <Layout title="Timeboxer">
      <section
        mix={css({
          margin: '0 auto',
          maxWidth: '760px',
          padding: `32px ${theme.space.xl}`,
        })}
      >
        <p
          mix={css({
            color: theme.colors.text.muted,
            fontSize: theme.fontSize.xs,
            fontWeight: theme.fontWeight.semibold,
            letterSpacing: theme.letterSpacing.wide,
            textTransform: 'uppercase',
          })}
        >
          Timeboxer
        </p>
        <h1
          mix={css({
            color: theme.colors.text.primary,
            fontSize: theme.fontSize.xxl,
            letterSpacing: theme.letterSpacing.tight,
            lineHeight: theme.lineHeight.tight,
            margin: 0,
          })}
        >
          Plan your focused work.
        </h1>
        <p
          mix={css({
            color: theme.colors.text.secondary,
            fontSize: theme.fontSize.md,
            lineHeight: theme.lineHeight.relaxed,
            maxWidth: '560px',
          })}
        >
          Authentication is ready with SQLite users, separate password records, and session-backed
          sign-in.
        </p>
      </section>
    </Layout>
  )
}
