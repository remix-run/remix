import { createCookieSessionStorage } from "remix";

export let sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "theme-css",
    secrets: ["fjdlafjdkla"]
  }
});

export let defaultStyles: Record<string, string> = {
  "--nc-tx-1": "#ffffff",
  "--nc-tx-2": "#eeeeee",
  "--nc-bg-1": "#000000",
  "--nc-bg-2": "#111111",
  "--nc-bg-3": "#222222",
  "--nc-lk-1": "#3291FF",
  "--nc-lk-2": "#0070F3",
  "--nc-lk-tx": "#FFFFFF",
  "--nc-ac-1": "#7928CA",
  "--nc-ac-tx": "#FFFFFF"
};
