export interface OutboxEmail {
  to: string
  subject: string
  text: string
  link?: string
  code?: string
}

const maxOutboxSize = 50
const outbox: OutboxEmail[] = []

// The demo has no mail service, so sign-in emails are kept in memory and shown on the
// "check your email" pages instead of being delivered.
export function sendOutboxEmail(email: OutboxEmail): void {
  outbox.unshift(email)
  outbox.splice(maxOutboxSize)
}

export function readLatestOutboxEmail(to: string): OutboxEmail | undefined {
  return outbox.find((email) => email.to === to)
}
