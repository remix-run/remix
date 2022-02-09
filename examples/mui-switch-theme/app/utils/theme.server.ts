import { createCookie } from "remix";

import { DEFAULT_THEME } from "~/themes";

import type { ThemeNames } from "~/themes";

// Create theme cookie
export const themeCookie = createCookie("theme");

/**
 * Returns the current theme from cookie
 */
const getThemeCookie = async (request: Request): Promise<any> => {
  return await themeCookie.parse(request.headers.get("Cookie"));
};

/**
 * Returns the theme from cookie OR system preferred theme OR default theme
 */
export const getUserTheme = async (request: Request): Promise<ThemeNames> => {
  const userPreferredTheme = await getThemeCookie(request);
  // Tells the client to send the user preferred theme: https://web.dev/user-preference-media-features-headers/
  const systemPreferredTheme = request.headers.get(
    "Sec-CH-Prefers-Color-Scheme"
  );
  return userPreferredTheme ?? systemPreferredTheme ?? DEFAULT_THEME;
};
