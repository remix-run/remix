import { createCookieSessionStorage, redirect } from "remix";
import { createUser, verifyLogin, getUser as getDbUser } from "./db.server";
import { getServerSafeEnvVariable } from "~/utils";
import type { User } from "~/models";

export const sessionSecret = getServerSafeEnvVariable("SESSION_SECRET");
export const sessionKey = "super_sick_pm_camp_session_key";
export const sessionUserKey = "userId";

export async function register(args: {
  email: string;
  password: string;
  nameFirst: string;
  nameLast?: string | null;
}) {
  return await createUser(args);
}

export async function login(email: string, password: string) {
  return await verifyLogin(email, password);
}

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: sessionKey,
    // secure doesn't work on localhost for Safari
    // https://web.dev/when-to-use-local-https/
    secure: process.env.NODE_ENV === "production",
    secrets: [sessionSecret],
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: true
  }
});

export function getUserSession(request: Request) {
  return sessionStorage.getSession(request.headers.get("Cookie"));
}

export async function getUserId(request: Request) {
  const session = await getUserSession(request);
  const userId = session.get("userId");
  if (!userId || typeof userId !== "string") return null;
  return userId;
}

export async function requireUserId(
  request: Request,
  opts: {
    redirect?: string;
    loginURL: string;
  }
) {
  const session = await getUserSession(request);
  const userId = session.get(sessionUserKey);
  if (!userId || typeof userId !== "string") {
    const searchParams = new URLSearchParams([
      ["redirectTo", opts.redirect || new URL(request.url).pathname]
    ]);
    throw redirect(`/${opts.loginURL}?${searchParams}`);
  }
  return userId;
}

export async function getUser(
  request: Request,
  opts: { loginURL?: string } = {}
) {
  const userId = await getUserId(request);
  if (typeof userId !== "string") {
    return null;
  }

  try {
    return await getDbUser(userId);
  } catch {
    if (opts.loginURL) {
      throw logout(request, { redirect: opts.loginURL });
    }
  }
}

export async function redirectUser(
  request: Request,
  opts: { redirect: string }
): Promise<null> {
  const user = await getUser(request);
  if (user) {
    throw redirect(opts.redirect);
  }
  return null;
}

export async function requireUser(
  request: Request,
  opts: { redirect: string }
): Promise<User> {
  const user = await getUser(request);
  if (!user) {
    throw redirect(opts.redirect);
  }
  return user;
}

export async function logout(request: Request, opts: { redirect: string }) {
  const session = await sessionStorage.getSession(
    request.headers.get("Cookie")
  );
  return redirect(opts.redirect, {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session)
    }
  });
}

export async function createUserSession(
  userId: User["id"],
  opts: { redirect: string }
) {
  const session = await sessionStorage.getSession();
  session.set(sessionUserKey, userId);
  return redirect(opts.redirect, {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session)
    }
  });
}
