// import { env } from "cloudflare:workers";
// import { createCookie } from "remix/cookie";
// import { auth, createSessionAuthScheme } from "remix/middleware/auth";
// import { session } from "remix/middleware/session";
import { createRouter } from "remix/router";

import controller from "./actions/controller.ts";
// import { kvSessionStorage } from "./kv-session-storage.ts";
import { routes } from "./routes.ts";

// const sessionCookie = createCookie("session", {
//   secrets: [env.SESSION_SECRET],
//   httpOnly: true,
//   sameSite: "Lax",
//   maxAge: 2592000,
//   path: "/",
// });

// const sessionStorage = kvSessionStorage(env.SESSION_STORE);

// type SessionData = {
//   userDid?: string;
// };

export const router = createRouter({
  middleware: [
    // session(sessionCookie, sessionStorage),
    // auth({
    //   schemes: [
    //     createSessionAuthScheme<SessionData, SessionData>({
    //       read(session) {
    //         let userDid = session.get("userDid") as string | undefined;
    //         if (typeof userDid !== "string" || !userDid) {
    //           userDid = undefined;
    //         }
    //         return { userDid };
    //       },
    //       verify(value) {
    //         return value;
    //       },
    //       invalidate(session) {
    //         session.unset("userDid");
    //       },
    //     }),
    //   ],
    // }),
  ],
});

router.map(routes, controller);
