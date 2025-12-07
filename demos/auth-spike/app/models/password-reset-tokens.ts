// In-memory password reset token storage
// In production, use a database with proper TTL/cleanup

let resetTokens = new Map<string, { userId: string; expiresAt: Date }>()

export async function createPasswordResetToken(
  token: string,
  userId: string,
  expiresAt: Date,
): Promise<void> {
  resetTokens.set(token, { userId, expiresAt })
}

export async function findPasswordResetTokenByToken(
  token: string,
): Promise<{ userId: string; expiresAt: Date } | null> {
  return resetTokens.get(token) ?? null
}

export async function deletePasswordResetTokenByToken(token: string): Promise<void> {
  resetTokens.delete(token)
}

// Helper for tests to reset state
export function resetPasswordResetTokens() {
  resetTokens.clear()
}
