import type { OAuthAccount } from '@remix-run/auth'

interface StoredOAuthAccount extends OAuthAccount {
  userId: string
}

// In-memory OAuth account storage
let oauthAccounts = new Map<string, StoredOAuthAccount>()

function getKey(provider: string, providerAccountId: string): string {
  return `${provider}:${providerAccountId}`
}

export async function findOAuthAccountByProvider(
  provider: string,
  providerAccountId: string,
): Promise<StoredOAuthAccount | null> {
  return oauthAccounts.get(getKey(provider, providerAccountId)) ?? null
}

export async function createOAuthAccount(
  userId: string,
  account: OAuthAccount,
): Promise<void> {
  oauthAccounts.set(getKey(account.provider, account.providerAccountId), {
    userId,
    ...account,
  })
}

export async function updateOAuthAccount(
  userId: string,
  provider: string,
  updates: Partial<OAuthAccount>,
): Promise<void> {
  // Find the account for this user and provider
  for (let [key, account] of oauthAccounts.entries()) {
    if (account.userId === userId && account.provider === provider) {
      oauthAccounts.set(key, { ...account, ...updates })
      return
    }
  }
}

export function resetOAuthAccounts(): void {
  oauthAccounts.clear()
}

