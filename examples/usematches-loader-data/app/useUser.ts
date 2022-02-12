import { useMatchesData } from "./useMatchesData";

interface User {
  name: string;
  email: string;
}

function isUser(user: unknown): user is User {
  return (
    !!user &&
    typeof (user as User).name === "string" &&
    typeof (user as User).email === "string"
  );
}

/**
 * Build a custom hook for each data object
 * of your loader data.
 * Use useMatchesData to access loader data
 * across your application.
 * Use tiny-invariant and Typescript "is"
 * to require data on runtime.
 * Or return undefined if data is optional and not found.
 */
export function useOptionalUser(): User | undefined {
  const data = useMatchesData("root");
  if (!data || !isUser(data.user)) {
    return undefined;
  }
  return data.user;
}

export function useUser(): User {
  const maybeUser = useOptionalUser();
  if (!maybeUser) {
    throw new Error(
      "No user found in root loader, but user is required by useUser. If user is optional, try useOptionalUser instead."
    );
  }
  return maybeUser;
}

export type { User };
