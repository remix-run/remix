import type { Database } from 'remix/data-table'

import { users } from '../../data/schema.ts'
import type { User } from '../../data/schema.ts'

// A verified address proves ownership, so the first email sign-in creates the account.
export async function resolveEmailUser(db: Database, email: string): Promise<User> {
  let user = await db.findOne(users, { where: { email } })

  if (user == null) {
    return createVerifiedUser(db, email)
  }

  if (user.email_verified_at == null) {
    // Signup does not verify addresses, so someone else may have registered this one with a
    // password. The owner has now proven control of it, so that unproven password stops working.
    return db.update(users, user.id, { email_verified_at: Date.now(), password_hash: null })
  }

  return user
}

export function getResendMessage(credential: 'link' | 'code', retryAfter?: Date): string {
  if (retryAfter == null) {
    return `Too many requests. Please wait before requesting another ${credential}.`
  }

  let seconds = Math.max(1, Math.ceil((retryAfter.getTime() - Date.now()) / 1000))
  return `We already sent a ${credential} to this address. Check your email, or request a new ${credential} in ${seconds} ${seconds === 1 ? 'second' : 'seconds'}.`
}

async function createVerifiedUser(db: Database, email: string): Promise<User> {
  try {
    return await db.create(users, { email, email_verified_at: Date.now() }, { returnRow: true })
  } catch (error) {
    // A concurrent first sign-in for the same address may have created the user already.
    let user = await db.findOne(users, { where: { email } })
    if (user == null) {
      throw error
    }

    return user
  }
}
