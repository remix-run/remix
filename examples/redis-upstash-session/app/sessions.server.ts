import {
	createCookie,
} from "remix";
import { createUpstashSessionStorage } from "~/sessions/upstash.server";

// This will set the length of the session.
// For the example we use very short duration to easily demonstrate its functionally.
const EXPIRATION_DURATION_IN_SECONDS = 10;

const expires = new Date();
expires.setSeconds(expires.getSeconds() + EXPIRATION_DURATION_IN_SECONDS);

const sessionCookie = createCookie("__session", {
	secrets: ["r3m1xr0ck1"],
	sameSite: true,
	expires
});


const { getSession, commitSession, destroySession } = createUpstashSessionStorage(
	{ cookie: sessionCookie }
);


export { getSession, commitSession, destroySession };