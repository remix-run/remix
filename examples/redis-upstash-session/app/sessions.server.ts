import { createCookie } from "@remix-run/node";
import { createUpstashSessionStorage } from "~/sessions/upstash.server";

// This will set the length of the session.
// For the example we use very short duration to easily demonstrate its functionally.
const EXPIRATION_DURATION_IN_SECONDS = 10;

const sessionCookie = createCookie("__session", {
  secrets: ["r3m1xr0ck1"],
  sameSite: true,
  expires: new Date(Date.now() + EXPIRATION_DURATION_IN_SECONDS * 1000),
});

const { getSession, commitSession, destroySession } =
  createUpstashSessionStorage({ cookie: sessionCookie });

export { getSession, commitSession, destroySession };
