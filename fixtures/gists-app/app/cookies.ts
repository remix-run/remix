import { createCookie } from "remix";

export let userPrefsCookie = createCookie("user-prefs", {
  path: "/",
  httpOnly: false
});
