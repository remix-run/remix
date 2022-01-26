import { createCookieSessionStorage, Session } from "remix";
import invariant from "tiny-invariant";

invariant(process.env.SESSION_SECRET, "SESSION_SECRET must be set");

let sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
    sameSite: "lax",
    secrets: [process.env.SESSION_SECRET],
    secure: process.env.NODE_ENV === "production",
  },
});

async function getSession(input: string | Request | null): Promise<Session> {
  let cookieHeader =
    input instanceof Request ? input.headers.get("Cookie") : input;

  return sessionStorage.getSession(cookieHeader);
}

export { sessionStorage, getSession };
