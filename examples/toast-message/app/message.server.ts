import { createCookieSessionStorage } from "remix";

const ONE_YEAR = 1000 * 60 * 60 * 24 * 365;

const { commitSession, getSession } = createCookieSessionStorage({
  cookie: {
    name: "__message",
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    expires: new Date(Date.now() + ONE_YEAR),
    secrets: ["SUPER_SECRET"],
    secure: true
  }
});

const setSuccessMessage = async (request: Request, message: string) => {
  const session = await getSession(request.headers.get("cookie"));

  session.flash("message", message);
  session.flash("type", "success");

  return session;
};

const setErrorMessage = async (request: Request, message: string) => {
  const session = await getSession(request.headers.get("cookie"));

  session.flash("message", message);
  session.flash("type", "error");

  return session;
};

export { setErrorMessage, setSuccessMessage, commitSession, getSession };
