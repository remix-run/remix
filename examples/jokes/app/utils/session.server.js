import { createCookieSessionStorage } from "remix";

import { prisma } from "./prisma.server";
let sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret) {
  throw new Error("SESSION_SECRET must be st");
}

let sessionExpirationTime = 1000 * 60 * 60 * 24 * 30;
let sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "RJ_session",
    secure: true,
    secrets: [sessionSecret],
    sameSite: "lax",
    path: "/",
    maxAge: sessionExpirationTime / 1000,
    httpOnly: true,
  },
});

async function getSession(request) {
  let sessionIdKey = "__session_id__";
  let session = await sessionStorage.getSession(request.headers.get("Cookie"));

  let getSessionId = () => session.get(sessionIdKey);

  let unsetSessionId = () => session.unset(sessionIdKey);

  let setSessionId = (value) => session.set(sessionIdKey, value);

  return {
    commit: sessionStorage.commitSession(session),
    getUser: async () => {
      let sessionId = getSessionId();
      if (!sessionId) return null;
      return prisma.session
        .findFirst({
          where: {
            id: sessionId,
          },
        })
        .catch((error) => {
          unsetSessionId();
          console.error(`Failure getting user from session ID:`, error);
          return null;
        });
    },
    signIn: async (userId) => {
      let userSession = await prisma.session.create({
        data: {
          userId,
          expirationDate: new Date(Date.now() + sessionExpirationTime),
        },
      });
      setSessionId(userSession.id);
    },
    signOut: () => {
      let sessionId = session.get(sessionIdKey);

      if (sessionId) {
        unsetSessionId();
        prisma.session
          .delete({
            where: {
              id: sessionId,
            },
          })
          .catch((error) => {
            console.error(`Failure deleting user session: `, error);
          });
      }
    },
  };
}

export { getSession };
