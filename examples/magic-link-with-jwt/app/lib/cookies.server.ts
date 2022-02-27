import { createCookieSessionStorage, json, redirect } from "remix";
import type { Session } from "remix";
import jwt from "jsonwebtoken";
import { mAdmin } from "~/lib/mAdmin.server";

const sessionName = "magicUserToken";

const sessionLengthInData = parseInt(
  process.env.MAGIC_SESSION_LENGTH_IN_DAYS as string
);

const maxAge = 60 * 60 * 24 * sessionLengthInData;

const jwtConfig = {
  exp: Math.floor(Date.now() / 1000) + maxAge,
};

const jwtSecret = process.env.JWT_SECRET as string;

const { getSession, destroySession, commitSession } =
  createCookieSessionStorage({
    cookie: {
      maxAge: maxAge,
      expires: new Date(Date.now() + maxAge + 1000),
      httpOnly: true,
      secure: process.env.NODE_EV === "production",
      path: "/",
      sameSite: "lax",
    },
  });

export const createUserSession = async (
  redirectTo: string,
  token: string
): Promise<Response> => {
  const session = await getSession();
  session.set(sessionName, token);
  return redirect(redirectTo, {
    headers: { "Set-Cookie": await commitSession(session) },
  });
};

export const getUserSession = async (req: Request): Promise<Session> => {
  return getSession(req.headers.get("Cookie"));
};

export const getUserSessionMetadata = async (
  req: Request
): Promise<Response | null> => {
  const session = await getUserSession(req);

  const token = session.get(sessionName);
  if (typeof token !== "string") return null;

  const metadata = jwt.verify(token, jwtSecret);
  if (typeof metadata === "string") return null;

  // TODO: Handle duplication with login.server.ts.
  const newToken = jwt.sign(
    {
      ...metadata,
      ...jwtConfig,
    },
    jwtSecret
  );

  session.set(sessionName, newToken);

  return json(metadata, {
    status: 200,
    headers: { "Set-Cookie": await commitSession(session) },
  });
};

export const logout = async (req: Request): Promise<Response | null> => {
  try {
    const session = await getUserSession(req);

    const token = session.get(sessionName);
    if (typeof token !== "string") return null;

    const metadata = jwt.verify(token, jwtSecret);
    if (typeof metadata === "string") return null;

    try {
      await mAdmin.users.logoutByIssuer(metadata.issuer);
    } catch (err) {
      console.log("User session with Magic already expired");
    }

    return redirect("/admin/login", {
      headers: { "Set-Cookie": await destroySession(session) },
    });
  } catch (err) {
    return json("User is not logged in", 401);
  }
};

export const login = async (didToken: string): Promise<Response> => {
  try {
    await mAdmin.token.validate(didToken);
    const metadata = await mAdmin.users.getMetadataByToken(didToken);

    const token = jwt.sign(
      {
        ...metadata,
        ...jwtConfig,
      },
      jwtSecret
    );

    return createUserSession("/admin/dashboard", token);
  } catch (err) {
    console.log(err);
    return json({ isValid: false }, 500);
  }
};
