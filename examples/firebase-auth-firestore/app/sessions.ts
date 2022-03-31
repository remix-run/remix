import { createCookieSessionStorage } from "remix";

export const { getSession, commitSession, destroySession } =
  createCookieSessionStorage({
    cookie: {
      name: "__session",
      secrets: ["fancy-secret-key"],
      maxAge: 60 * 60 * 24 * 7, // 1 week
      sameSite: "lax",
      path: "/",
      httpOnly: true,
    },
  });
