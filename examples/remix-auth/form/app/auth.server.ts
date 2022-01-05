import { createCookieSessionStorage } from "remix";
import { Authenticator, AuthorizationError } from "remix-auth";
import { FormStrategy } from "remix-auth-form";

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: ["s3cret"], // This should be an env variable
    secure: process.env.NODE_ENV === "production"
  }
});

export const auth = new Authenticator<string>(sessionStorage);

auth.use(
  new FormStrategy(async ({ form }) => {
    const password = form.get("password");

    if (!password) throw new AuthorizationError("Password is required");

    if (password !== "test") {
      throw new AuthorizationError("Invalid credentials");
    }

    const email = form.get("email");

    if (!email) throw new AuthorizationError("Email is required");

    return email as string;
  })
);
