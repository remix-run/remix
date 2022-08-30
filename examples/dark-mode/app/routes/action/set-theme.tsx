import type { ActionFunction, LoaderFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";

import { getThemeSession } from "~/utils/theme.server";
import { isTheme } from "~/utils/theme-provider";

export const action: ActionFunction = async ({ request }) => {
  const themeSession = await getThemeSession(request);
  const form = await request.formData();
  const theme = form.get("theme");
  const redirectTo = form.get("redirectTo");

  if (!isTheme(theme)) {
    return json({
      success: false,
      message: `theme value of ${theme} is not a valid theme`,
    });
  }

  if (redirectTo && typeof redirectTo !== "string") {
    return json({
      success: false,
      message: `redirect URL should be a string`,
    });
  }

  themeSession.setTheme(theme);

  const headers = { "Set-Cookie": await themeSession.commit() };

  if (redirectTo) {
    return redirect(redirectTo, { headers });
  }

  return json({ success: true }, { headers });
};

export const loader: LoaderFunction = () => redirect("/", { status: 404 });
