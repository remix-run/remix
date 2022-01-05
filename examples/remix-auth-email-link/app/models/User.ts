export type User = {
  // Add other fields (if any) here
  email: string
}

export async function getUser({email}: {email: string}): Promise<User> {
  // You should create/fetch this user from your db
  return Promise.resolve({email})
}