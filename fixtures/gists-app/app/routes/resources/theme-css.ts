import type { ActionFunction, LoaderFunction } from "remix";
import { redirect } from "remix";
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

export let action: ActionFunction = async ({ request }) => {
  let formData = new URLSearchParams(await request.text());

  let session = await sessionStorage.getSession(request.headers.get("Cookie"));
  let custom: Record<string, string> = session.get("custom") || {};

  if (formData.get("event") === "reset") {
    return redirect("/resources/settings", {
      headers: {
        "Set-Cookie": await sessionStorage.destroySession(session)
      }
    });
  }

  for (let [key, value] of formData) {
    if (key in defaultStyles) {
      custom[key] = value || defaultStyles[key];
    }
  }

  session.set("custom", custom);

  return redirect("/resources/settings", {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session)
    }
  });
};

export let loader: LoaderFunction = async ({ request }) => {
  let session = await sessionStorage.getSession(request.headers.get("Cookie"));
  let custom = session.get("custom") || {};

  return new Response(
    `/* this css was generated via a loader in a remix resource route */
:root {
  ${Object.entries(custom)
    .map(([key, value]) =>
      defaultStyles[key] && value ? `${key}: ${value};` : false
    )
    .filter(s => s)
    .join("\n  ")}
}
  `,
    {
      headers: {
        "Content-Type": "text/css; charset=UTF-8",
        "x-has-custom": Object.keys(custom).length > 0 ? "yes" : "no"
      }
    }
  );
};
