Add passwordless email sign-in with magic links and one-time codes. `createMagicLinkAuthProvider()` with `sendMagicLink()` and `verifyMagicLink()` signs people in with single-use links. `createEmailOTPAuthProvider()` with `sendEmailOTP()` and `verifyEmailOTP()` sends numeric codes that people type into the app, so they can read email on one device and sign in on another (see #11964).

```ts
let magicLinkProvider = createMagicLinkAuthProvider({
  storage: emailAuthStorage,
  verifyUrl: new URL('/login/email/verify', env.APP_ORIGIN),
  async sendEmail({ email, url }) {
    await mailer.send({ to: email, subject: 'Your sign-in link', text: url })
  },
})

router.post('/login/email/verify', async (context) => {
  let result = await verifyMagicLink(magicLinkProvider, context)
  if (result.status === 'failure') {
    return new Response('This sign-in link is invalid or has expired.', { status: 400 })
  }

  let user = await users.findOrCreateByEmail(result.email)
  completeAuth(context).set('auth', { userId: user.id })
  return redirect(result.returnTo ?? '/dashboard')
})
```

Applications provide persistent storage through the `EmailAuthStorage` interface (`get()`, `set()`, and the atomic `add()` and `take()`), deliver email with their own `sendEmail()` hook, and decide how a verified address maps to their own users. Link tokens are stored as SHA-256 hashes, and codes as HMAC-SHA256 hashes keyed by the required `secret` option. Each link or code is consumed atomically, so concurrent requests can redeem it at most once.

Sending a new link or code replaces the earlier one for that address. Both providers limit resends with `resendInterval`, even when requests arrive in parallel, email codes lock after `maxAttempts` incorrect submissions, and `checkRateLimit()` plugs in application rate limits. The send and verify functions return failure codes such as `invalid_token`, `expired_code`, `too_many_attempts`, and `rate_limited` instead of throwing, so routes can show one public message while still handling the specific reason.
