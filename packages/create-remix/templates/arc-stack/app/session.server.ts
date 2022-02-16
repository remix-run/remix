import type { Session } from "remix";
import { redirect, createArcTableSessionStorage } from "remix";
import invariant from "tiny-invariant";

invariant(process.env.SESSION_SECRET, "SESSION_SECRET must be set");

export const sessionStorage = createArcTableSessionStorage({
  table: "arc-sessions",
  ttl: "_ttl",
  idx: "_idx",
  cookie: {
    name: "__session",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
    sameSite: "lax",
    secrets: [process.env.SESSION_SECRET],
    secure: process.env.NODE_ENV === "production"
  }
});

const USER_SESSION_KEY = "userId";

export async function getSession(
  input: string | Request | null
): Promise<Session> {
  const cookieHeader =
    input instanceof Request ? input.headers.get("Cookie") : input;

  return sessionStorage.getSession(cookieHeader);
}

export async function getUserId(request: Request) {
  const session = await getSession(request);
  const user = session.get(USER_SESSION_KEY);
  if (!user) return null;
  return user;
}

export async function requireUser(
  request: Request,
  redirectTo: string = new URL(request.url).pathname
) {
  const user = await getUserId(request);
  if (!user) {
    const searchParams = new URLSearchParams([["redirectTo", redirectTo]]);
    throw redirect(`/login?${searchParams}`);
  }
  return user;
}

export async function createUserSession(
  request: Request,
  userId: string,
  redirectTo: string
) {
  const session = await getSession(request);
  session.set(USER_SESSION_KEY, userId);
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session)
    }
  });
}

export async function logout(request: Request) {
  const session = await getSession(request);
  return redirect("/login", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session)
    }
  });
}
