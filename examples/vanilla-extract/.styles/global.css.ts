/**
 * This file allows us to set up our global styles. If we also
 * wanted to apply a CSS reset, this is where we'd define it.
 *
 * More detail: https://vanilla-extract.style/documentation/global-api/global-style
 */
import { globalStyle } from "@vanilla-extract/css";

globalStyle("body", {
  "@media": {
    "(prefers-color-scheme: dark)": {
      backgroundColor: "#111",
    },
  },
});
