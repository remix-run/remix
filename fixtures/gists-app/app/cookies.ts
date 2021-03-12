import { createCookie } from "@remix-run/express";

export let userPrefsCookie = createCookie("user-prefs", {
  path: "/",
  httpOnly: false
});
