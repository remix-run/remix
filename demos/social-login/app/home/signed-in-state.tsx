import { css } from 'remix/component'

import type { AuthenticatedUser } from '../middleware/auth.ts'
import { routes } from '../routes.ts'
import { getLoginMethodLabel } from '../social-providers.ts'
import {
  authCardStyle,
  avatarFallbackStyle,
  avatarStyle,
  eyebrowStyle,
  identityRowStyle,
  logoutButtonStyle,
  mutedTextStyle,
  panelStyle,
  profileDumpSectionStyle,
  profileDumpStyle,
  sectionTitleStyle,
  stackLgStyle,
  stackSmStyle,
} from './styles.ts'

interface SignedInStateProps {
  user: AuthenticatedUser
}

export function SignedInState() {
  return ({ user }: SignedInStateProps) => (
    <section mix={[panelStyle, authCardStyle, stackLgStyle]}>
      <div
        mix={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '28px 28px 0',
          '@media (max-width: 640px)': {
            paddingLeft: '18px',
            paddingRight: '18px',
          },
        })}
      >
        <p mix={eyebrowStyle}>Authenticated session</p>
        <span
          mix={css({
            borderRadius: '999px',
            padding: '0.42rem 0.85rem',
            background: 'rgba(15, 159, 110, 0.12)',
            color: 'var(--success)',
            fontSize: '0.82rem',
            fontWeight: 700,
          })}
        >
          Signed in
        </span>
      </div>

      <div mix={identityRowStyle}>
        <Avatar user={user} />
        <div mix={stackSmStyle}>
          <p mix={eyebrowStyle}>Signed in with {getLoginMethodLabel(user.loginMethod)}</p>
          <h2 mix={sectionTitleStyle}>{user.name ?? user.email ?? 'Authenticated user'}</h2>
        </div>
      </div>

      <div mix={[profileDumpSectionStyle, stackSmStyle]}>
        <p mix={mutedTextStyle}>
          The following JSON is the resolved auth profile that this request received from{' '}
          <code>context.get(Auth)</code>.
        </p>
        <pre mix={profileDumpStyle}>{JSON.stringify(user, null, 2)}</pre>
      </div>

      <form method="POST" action={routes.auth.logout.href()}>
        <button type="submit" mix={logoutButtonStyle}>
          Log out
        </button>
      </form>
    </section>
  )
}

function Avatar() {
  return ({ user }: SignedInStateProps) => {
    if (user.avatarUrl) {
      return <img mix={avatarStyle} src={user.avatarUrl} alt="Authenticated user avatar" />
    }

    return <div mix={[avatarStyle, avatarFallbackStyle]}>{getInitials(user)}</div>
  }
}

function getInitials(user: AuthenticatedUser): string {
  let source = user.name ?? user.email ?? getLoginMethodLabel(user.loginMethod)
  let parts = source.split(/\s+/).filter(Boolean)
  let initials = parts
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('')

  return initials || 'U'
}
