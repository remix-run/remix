import useLoaderStore from "./useLoaderStore";

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

export default function useUser(): User | undefined {
  const user = useLoaderStore("user");
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
