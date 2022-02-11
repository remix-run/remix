import { json, redirect } from "remix";
import type { Session } from "remix";
import { sessionStorage, sessionKey, getUserSession } from "~/session.server";
import type { User } from "~/models";

const ERROR_KEY = "auth:error";

export async function authenticate(
  request: Request,
  {
    loginURL,
    passwordField,
    usernameField,
    verify,
    failureRedirect
  }: {
    loginURL: string;
    passwordField: string;
    usernameField: string;
    verify: (username: string, password: string) => Promise<User>;
    failureRedirect?: string;
  }
): Promise<User> {
  if (request.method.toUpperCase() !== "POST") {
    throw json(
      { message: "`authenticate` can only be called in a POST request" },
      { status: 405 }
    );
  }

  const formData = await request.formData();
  const username = formData.get(usernameField);
  const password = formData.get(passwordField);

  // Validation!
  const session = await getUserSession(request);

  if (
    typeof username !== "string" ||
    !username ||
    typeof password !== "string" ||
    !password
  ) {
    if (typeof username !== "string" || !username) {
      session.flash(`${ERROR_KEY}:user`, "Invalid username.");
    }
    if (typeof password !== "string" || !password) {
      session.flash(`${ERROR_KEY}:user`, "Invalid password.");
    }
    const cookie = await sessionStorage.commitSession(session);
    throw redirect(loginURL, { headers: { "Set-Cookie": cookie } });
  }

  let user: User;

  try {
    user = await verify(username, password);
  } catch (error) {
    const message = (error as Error).message;
    if (!failureRedirect) {
      throw json({ message }, { status: 401 });
    }
    session.flash(ERROR_KEY, { message });
    throw redirect(failureRedirect, {
      headers: { "Set-Cookie": await sessionStorage.commitSession(session) }
    });
  }

  return user;
}

export async function isAuthenticated(
  request: Session,
  options?: { failureRedirect?: never }
): Promise<User | null>;
export async function isAuthenticated(
  request: Session,
  options: { failureRedirect: string }
): Promise<User>;

export async function isAuthenticated(
  session: Session,
  options: { failureRedirect?: never } | { failureRedirect: string } = {}
): Promise<User | null> {
  const user: User | null = session.get(sessionKey) ?? null;

  if (user) {
    return user;
  }

  if (options.failureRedirect) {
    throw redirect(options.failureRedirect);
  }

  return null;
}
