import useMatchesData from "./useMatchesData";

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
export default function useOptionalUser(): User | undefined {
  const { user } = useMatchesData("root");
  /*
   * You can make use of tiny-invariant here to throw runtime errors
   * if the loader data is required and not optional
   */
  if (!isUser(user)) {
    return undefined;
  }
  return user;
}

export type { User };
