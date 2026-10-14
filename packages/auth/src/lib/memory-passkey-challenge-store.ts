import type { PasskeyChallengeStore } from './providers/passkey.ts'

const maxChallenges = 10_000

/**
 * Creates an in-memory passkey challenge store.
 *
 * Challenges live in the current process only, so use a shared store such as a database table or
 * Redis when the app runs on more than one server instance. The store keeps at most 10,000
 * challenges and drops the oldest ones first.
 *
 * @returns A challenge store for `createPasskeyAuthProvider()`.
 */
export function createMemoryPasskeyChallengeStore(): PasskeyChallengeStore {
  let challenges = new Map<string, number>()

  return {
    save(challenge, expiresAt) {
      // Maps iterate in insertion order, which tracks expiry order closely enough to stop pruning
      // at the first live challenge instead of scanning the whole store on every save.
      let now = Date.now()
      for (let [storedChallenge, storedExpiresAt] of challenges) {
        if (storedExpiresAt > now) break
        challenges.delete(storedChallenge)
      }

      // Anyone can start a sign-in, so cap the store and drop the oldest challenges first.
      while (challenges.size >= maxChallenges) {
        challenges.delete(challenges.keys().next().value!)
      }

      challenges.set(challenge, expiresAt.getTime())
    },
    consume(challenge) {
      let expiresAt = challenges.get(challenge)
      challenges.delete(challenge)
      return expiresAt != null && expiresAt > Date.now()
    },
  }
}
