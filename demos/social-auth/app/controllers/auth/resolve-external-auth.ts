import type { GitHubAuthProfile, GoogleAuthProfile, OAuthResult, XAuthProfile } from 'remix/auth'
import type { Database } from 'remix/data-table'
import { query } from 'remix/data-table'

import { authAccounts, normalizeEmail, users } from '../../data/schema.ts'
import type { AuthAccount, User } from '../../data/schema.ts'

type ExternalAuthResult =
  | OAuthResult<GoogleAuthProfile, 'google'>
  | OAuthResult<GitHubAuthProfile, 'github'>
  | OAuthResult<XAuthProfile, 'x'>

type ExternalProfileDetails = {
  email?: string
  linkableEmail?: string
  username?: string
  displayName?: string
  avatarUrl?: string
  profileJson: string
}

export async function resolveExternalAuth(
  db: Database,
  result: ExternalAuthResult,
): Promise<{ user: User; authAccount: AuthAccount }> {
  let existingAccount = await db.exec(
    query(authAccounts)
      .where({
        provider: result.provider,
        provider_account_id: result.account.providerAccountId,
      })
      .first(),
  )
  let profile = extractProfile(result)

  if (existingAccount != null) {
    let user = await db.exec(query(users).find(existingAccount.user_id))

    if (user == null) {
      user = await createUserFromProfile(db, profile)
      await db.exec(query(authAccounts).where({ id: existingAccount.id }).update({ user_id: user.id }))
      existingAccount = (await db.exec(query(authAccounts).find(existingAccount.id))) ?? existingAccount
    } else {
      user = await updateUserFromProfile(db, user, profile)
    }

    let authAccount = await updateAuthAccount(db, existingAccount, profile)
    return { user, authAccount }
  }

  let linkedUser =
    profile.linkableEmail != null
      ? await db.exec(query(users).where({ email: profile.linkableEmail }).first())
      : null

  let user =
    linkedUser == null
      ? await createUserFromProfile(db, profile)
      : await updateUserFromProfile(db, linkedUser, profile)

  let createResult = await db.exec(
    query(authAccounts).insert(
      {
      user_id: user.id,
      provider: result.provider,
      provider_account_id: result.account.providerAccountId,
      email: profile.email,
      username: profile.username,
      display_name: profile.displayName,
      avatar_url: profile.avatarUrl,
      profile_json: profile.profileJson,
      },
      { returning: '*' },
    ),
  )
  let authAccount = 'row' in createResult ? createResult.row : null

  if (authAccount == null) {
    throw new Error('Failed to create auth account')
  }

  return { user, authAccount }
}

function extractProfile(result: ExternalAuthResult): ExternalProfileDetails {
  if (result.provider === 'google') {
    let email =
      typeof result.profile.email === 'string' ? normalizeEmail(result.profile.email) : undefined

    return {
      email,
      linkableEmail: email != null && result.profile.email_verified !== false ? email : undefined,
      username:
        typeof result.profile.preferred_username === 'string'
          ? result.profile.preferred_username
          : undefined,
      displayName: typeof result.profile.name === 'string' ? result.profile.name : undefined,
      avatarUrl: typeof result.profile.picture === 'string' ? result.profile.picture : undefined,
      profileJson: JSON.stringify(result.profile),
    }
  }

  if (result.provider === 'github') {
    let email =
      typeof result.profile.email === 'string' ? normalizeEmail(result.profile.email) : undefined

    return {
      email,
      linkableEmail: email,
      username: result.profile.login,
      displayName:
        typeof result.profile.name === 'string' && result.profile.name.trim() !== ''
          ? result.profile.name
          : result.profile.login,
      avatarUrl:
        typeof result.profile.avatar_url === 'string' ? result.profile.avatar_url : undefined,
      profileJson: JSON.stringify(result.profile),
    }
  }

  return {
    username: result.profile.username,
    displayName: result.profile.name,
    avatarUrl:
      typeof result.profile.profile_image_url === 'string'
        ? result.profile.profile_image_url
        : undefined,
    profileJson: JSON.stringify(result.profile),
  }
}

async function createUserFromProfile(db: Database, profile: ExternalProfileDetails): Promise<User> {
  let createResult = await db.exec(
    query(users).insert(
      {
      email: profile.linkableEmail,
      name: profile.displayName,
      avatar_url: profile.avatarUrl,
      },
      { returning: '*' },
    ),
  )
  let user = 'row' in createResult ? createResult.row : null

  if (user == null) {
    throw new Error('Failed to create user')
  }

  return user
}

async function updateUserFromProfile(
  db: Database,
  user: User,
  profile: ExternalProfileDetails,
): Promise<User> {
  let changes: Partial<User> = {}

  if (profile.linkableEmail != null && user.email !== profile.linkableEmail) {
    changes.email = profile.linkableEmail
  }

  if (profile.displayName != null && user.name !== profile.displayName) {
    changes.name = profile.displayName
  }

  if (profile.avatarUrl != null && user.avatar_url !== profile.avatarUrl) {
    changes.avatar_url = profile.avatarUrl
  }

  if (Object.keys(changes).length === 0) {
    return user
  }

  await db.exec(query(users).where({ id: user.id }).update(changes))
  return (await db.exec(query(users).find(user.id))) ?? user
}

async function updateAuthAccount(
  db: Database,
  authAccount: AuthAccount,
  profile: ExternalProfileDetails,
): Promise<AuthAccount> {
  await db.exec(
    query(authAccounts).where({ id: authAccount.id }).update({
      email: profile.email,
      username: profile.username,
      display_name: profile.displayName,
      avatar_url: profile.avatarUrl,
      profile_json: profile.profileJson,
    }),
  )

  return (await db.exec(query(authAccounts).find(authAccount.id))) ?? authAccount
}
