import { createCookie } from "@remix-run/node";

export let userPrefsCookie = createCookie("user-prefs", {
  path: "/",
  httpOnly: false
});
