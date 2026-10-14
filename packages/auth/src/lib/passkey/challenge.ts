import type { RequestContext } from '@remix-run/fetch-router'
import type { Session } from '@remix-run/session'

import type { PasskeyAuthProvider } from '../providers/passkey.ts'
import { createRandomToken } from '../utils.ts'
import { PasskeyVerificationError } from './errors.ts'

export type PasskeyCeremony = 'registration' | 'authentication'

interface PendingPasskeyChallenge {
  provider: string
  ceremony: PasskeyCeremony
  challenge: string
  expiresAt: number
  userId?: string
  allowCredentials?: string[]
}

interface IssuePasskeyChallengeOptions {
  key: string
  ceremony: PasskeyCeremony
  userId?: string
  allowCredentials?: string[]
}

export const defaultChallengeKey = '__passkey'

// Several challenges can be pending at once, such as sign-in pages open in two tabs, but the
// session keeps only the most recent ones.
const maxPendingChallenges = 5

export async function issuePasskeyChallenge(
  provider: PasskeyAuthProvider,
  context: RequestContext,
  session: Session,
  options: IssuePasskeyChallengeOptions,
): Promise<string> {
  let challenge = createRandomToken(32)
  let now = Date.now()
  let expiresAt = now + provider.timeout

  await provider.challengeStore.save(challenge, new Date(expiresAt), context)

  let pending: PendingPasskeyChallenge = {
    provider: provider.name,
    ceremony: options.ceremony,
    challenge,
    expiresAt,
  }
  if (options.userId != null) {
    pending.userId = options.userId
  }
  if (options.allowCredentials != null && options.allowCredentials.length > 0) {
    pending.allowCredentials = options.allowCredentials
  }

  let pendingChallenges = readPendingChallenges(session.get(options.key)).filter(
    (entry) => entry.expiresAt > now,
  )
  pendingChallenges.push(pending)
  session.set(options.key, pendingChallenges.slice(-maxPendingChallenges))

  return challenge
}

// Removes the pending challenge a response was signed for. Each challenge gets exactly one
// verification attempt from the session that requested it, whether that attempt succeeds or fails.
export function takePendingPasskeyChallenge(
  provider: PasskeyAuthProvider,
  session: Session,
  key: string,
  ceremony: PasskeyCeremony,
  challenge: string,
): PendingPasskeyChallenge {
  let pendingChallenges = readPendingChallenges(session.get(key))
  let index = pendingChallenges.findIndex(
    (entry) =>
      entry.challenge === challenge &&
      entry.provider === provider.name &&
      entry.ceremony === ceremony,
  )
  if (index === -1) {
    throw new PasskeyVerificationError(
      'challenge_missing',
      `No pending passkey ${ceremony} challenge in this session matches the response.`,
    )
  }

  let [pending] = pendingChallenges.splice(index, 1)
  let now = Date.now()
  let remainingChallenges = pendingChallenges.filter((entry) => entry.expiresAt > now)
  if (remainingChallenges.length === 0) {
    session.unset(key)
  } else {
    session.set(key, remainingChallenges)
  }

  if (pending.expiresAt <= now) {
    throw new PasskeyVerificationError(
      'challenge_expired',
      `The passkey ${ceremony} challenge expired.`,
    )
  }

  return pending
}

export async function consumePasskeyChallenge(
  provider: PasskeyAuthProvider,
  context: RequestContext,
  challenge: string,
): Promise<void> {
  if (!(await provider.challengeStore.consume(challenge, context))) {
    throw new PasskeyVerificationError(
      'challenge_consumed',
      'The passkey challenge was already used or is no longer valid.',
    )
  }
}

function readPendingChallenges(value: unknown): PendingPasskeyChallenge[] {
  return Array.isArray(value) ? value.filter(isPendingChallenge) : []
}

function isPendingChallenge(value: unknown): value is PendingPasskeyChallenge {
  if (typeof value !== 'object' || value == null) {
    return false
  }

  let pending = value as Record<string, unknown>
  return (
    typeof pending.provider === 'string' &&
    (pending.ceremony === 'registration' || pending.ceremony === 'authentication') &&
    typeof pending.challenge === 'string' &&
    typeof pending.expiresAt === 'number' &&
    (pending.userId == null || typeof pending.userId === 'string') &&
    (pending.allowCredentials == null ||
      (Array.isArray(pending.allowCredentials) &&
        pending.allowCredentials.every((id) => typeof id === 'string')))
  )
}
