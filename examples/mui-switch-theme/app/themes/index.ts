import type { Theme } from "@mui/material";

import darkTheme from "~/themes/dark";
import lightTheme from "~/themes/light";

export type ThemeNames = "dark" | "light";

const themes: Record<ThemeNames, Theme> = {
  dark: darkTheme,
  light: lightTheme
};

export const DEFAULT_THEME = "dark";

/**
 * Return the MUI Theme object
 */
export function getTheme(themeName: ThemeNames = DEFAULT_THEME): Theme {
  return themes.hasOwnProperty(themeName)
    ? themes[themeName]
    : themes[DEFAULT_THEME];
}
