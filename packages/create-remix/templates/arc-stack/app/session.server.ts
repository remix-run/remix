import type { Session } from "remix";
import { redirect, createArcTableSessionStorage } from "remix";
import invariant from "tiny-invariant";

invariant(process.env.SESSION_SECRET, "SESSION_SECRET must be set");

const sessionStorage = createArcTableSessionStorage({
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

const USER_SESSION_KEY = "user";

async function getSession(input: string | Request | null): Promise<Session> {
  const cookieHeader =
    input instanceof Request ? input.headers.get("Cookie") : input;

  return sessionStorage.getSession(cookieHeader);
}

async function getUserId(request: Request) {
  const session = await getSession(request);
  const userId = session.get(USER_SESSION_KEY);
  if (!userId || typeof userId !== "string") return null;
  return userId;
}

async function requireUserId(
  request: Request,
  redirectTo: string = new URL(request.url).pathname
) {
  const session = await getSession(request);
  const userId = session.get("userId");
  if (!userId || typeof userId !== "string") {
    const searchParams = new URLSearchParams([["redirectTo", redirectTo]]);
    throw redirect(`/login?${searchParams}`);
  }
  return userId;
}

async function createUserSession(
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

async function logout(request: Request) {
  const session = await getSession(request);
  return redirect("/login", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session)
    }
  });
}

export {
  sessionStorage,
  getSession,
  getUserId,
  requireUserId,
  createUserSession,
  logout
};
