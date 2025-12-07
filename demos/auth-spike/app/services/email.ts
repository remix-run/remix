/**
 * Mock email service for demo purposes.
 * Logs emails to console and stores them in memory for tests to inspect.
 */

export interface Email {
  to: string
  subject: string
  text: string
  html?: string
  sentAt: Date
}

// In-memory storage for sent emails (for testing)
let sentEmails: Email[] = []

/**
 * Send a mock email (logs to console and stores in memory)
 */
export function sendEmail(email: Omit<Email, 'sentAt'>) {
  let emailWithTimestamp: Email = {
    ...email,
    sentAt: new Date(),
  }

  // Store for tests
  if (process.env.NODE_ENV === 'test') {
    sentEmails.push(emailWithTimestamp)
  }

  // Log to console (but not during tests)
  if (process.env.NODE_ENV !== 'test') {
    console.log('')
    console.log('📧 [Mock Email]')
    console.log('━'.repeat(60))
    console.log(`To: ${email.to}`)
    console.log(`Subject: ${email.subject}`)
    console.log('')
    console.log(email.text)
    console.log('━'.repeat(60))
    console.log('')
  }
}

/**
 * Get all sent emails (for testing)
 */
export function getSentEmails(): readonly Email[] {
  return [...sentEmails]
}

/**
 * Get the most recent email sent to a specific address (for testing)
 */
export function getLastEmailTo(email: string): Email | undefined {
  return sentEmails.filter((e) => e.to === email).pop()
}

/**
 * Clear all sent emails (for testing isolation)
 */
export function clearSentEmails() {
  sentEmails = []
}
