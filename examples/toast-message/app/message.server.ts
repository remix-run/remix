import { createCookieSessionStorage } from "remix";
import type { Session } from "remix";

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

const setSuccessMessage = (session: Session, message: string) => {
  session.flash("message", message);
  session.flash("type", "success");
};

const setErrorMessage = async (session: Session, message: string) => {
  session.flash("message", message);
  session.flash("type", "error");
};

export { setErrorMessage, setSuccessMessage, commitSession, getSession };
