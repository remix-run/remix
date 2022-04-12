import type { Session } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { signInWithEmailAndPassword } from "firebase/auth";
import type { UserRecord } from "firebase-admin/auth";

import { destroySession, getSession } from "~/sessions";
import { auth } from "./firebase.server";

export const checkSessionCookie = async (session: Session) => {
  try {
    const decodedIdToken = await auth.server.verifySessionCookie(
      session.get("session") || ""
    );
    return decodedIdToken;
  } catch {
    return { uid: undefined };
  }
};

export const requireAuth = async (request: Request): Promise<UserRecord> => {
  const session = await getSession(request.headers.get("cookie"));
  const { uid } = await checkSessionCookie(session);
  if (!uid) {
    throw redirect("/login", {
      headers: { "Set-Cookie": await destroySession(session) },
    });
  }
  return auth.server.getUser(uid);
};

export const signIn = async (email: string, password: string) => {
  const { user } = await signInWithEmailAndPassword(
    auth.client,
    email,
    password
  );
  const idToken = await user.getIdToken();
  const expiresIn = 1000 * 60 * 60 * 24 * 7; // 1 week
  const sessionCookie = await auth.server.createSessionCookie(idToken, {
    expiresIn,
  });
  return sessionCookie;
};

export const signUp = async (name: string, email: string, password: string) => {
  await auth.server.createUser({
    email,
    password,
    displayName: name,
  });
  return await signIn(email, password);
};
