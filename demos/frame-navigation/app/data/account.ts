export type Account = {
  displayName: string
  program: string
  expectedGraduation: string
}

export const accountConstraints = {
  displayName: { maxLength: 80 },
  program: { maxLength: 120 },
  expectedGraduation: { maxLength: 7 },
} as const

let account: Account = {
  displayName: 'Riley Student',
  program: 'Human Computer Interaction',
  expectedGraduation: '2027-05',
}

export function getAccount(): Account {
  return { ...account }
}

export function updateAccount(nextAccount: Account): Account {
  account = { ...nextAccount }
  return getAccount()
}
