import { createEmailOTPAuthProvider, createMagicLinkAuthProvider } from 'remix/auth'
import type { EmailAuthStorage } from 'remix/auth'
import { and, eq, lte } from 'remix/data-table'

import { emailAuthEntries } from '../data/schema.ts'
import { db } from '../db.ts'
import { routes } from '../routes.ts'
import { sendOutboxEmail } from './email-outbox.ts'
import { getDemoOrigin } from './external-auth.ts'

const emailOTPSecret = process.env.EMAIL_OTP_SECRET ?? 'social-auth-demo-email-otp-secret'

export const emailAuthStorage: EmailAuthStorage = {
  async get(key) {
    let entry = await db.find(emailAuthEntries, { key })
    return entry?.value ?? null
  },
  async set(key, value, expiresAt) {
    await db.deleteMany(emailAuthEntries, { where: lte('expires_at', Date.now()) })
    await db.query(emailAuthEntries).upsert({ key, value, expires_at: expiresAt.getTime() })
  },
  async add(key, value, expiresAt) {
    await db.deleteMany(emailAuthEntries, {
      where: and(eq('key', key), lte('expires_at', Date.now())),
    })

    // An empty update compiles to `on conflict do nothing`, so only one request can insert the key.
    let result = await db
      .query(emailAuthEntries)
      .upsert({ key, value, expires_at: expiresAt.getTime() }, { update: {} })
    return result.affectedRows === 1
  },
  async take(key) {
    let entry = await db.find(emailAuthEntries, { key })
    if (entry == null) {
      return null
    }

    // The delete only matches the value read above, so at most one request can take it.
    let result = await db.deleteMany(emailAuthEntries, { where: { key, value: entry.value } })
    return result.affectedRows === 1 ? entry.value : null
  },
}

export const magicLinkProvider = createMagicLinkAuthProvider({
  storage: emailAuthStorage,
  verifyUrl: new URL(routes.auth.magicLinkVerify.index.href(), getDemoOrigin()),
  sendEmail({ email, url, expiresAt }) {
    sendOutboxEmail({
      to: email,
      subject: 'Your sign-in link',
      text: `Use this link to sign in to the Social Auth Demo. It expires at ${expiresAt.toLocaleTimeString('en-US')}.`,
      link: url,
    })
  },
})

export const emailOTPProvider = createEmailOTPAuthProvider({
  storage: emailAuthStorage,
  secret: emailOTPSecret,
  sendEmail({ email, code, expiresAt }) {
    sendOutboxEmail({
      to: email,
      subject: 'Your sign-in code',
      text: `Enter this code to sign in to the Social Auth Demo. It expires at ${expiresAt.toLocaleTimeString('en-US')}.`,
      code,
    })
  },
})
