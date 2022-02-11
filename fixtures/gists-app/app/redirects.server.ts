import { createCookieSessionStorage } from "remix";

export let sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "redirectslogin",
    path: "/",
    httpOnly: true,
    sameSite: true,
    secure: process.env.NODE_ENV !== "development"
  }
});
