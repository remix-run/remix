import type { User } from "./useUser";

/**
 * Mock db/session function
 */
function getCurrentUser(): Promise<User | undefined> {
  return Promise.resolve({
    name: "John Doe",
    email: "john.doe@email.com"
  });
}

export { getCurrentUser };
