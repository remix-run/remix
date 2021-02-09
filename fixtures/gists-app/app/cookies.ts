import { createCookie } from "@remix-run/data";

export let userPrefsCookie = createCookie("user-prefs", {
  path: "/",
  httpOnly: false
});
