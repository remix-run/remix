import { createStitches } from "@stitches/react";

const stitches = createStitches({
  theme: {
    colors: {
      red: "#ff6d6d",
      steel: "#363645",
      black: "#000",
      white: "#fff",
      grey: "#666"
    }
  },
  media: {
    tabletUp: "(min-width: 768px)",
    desktopUp: "(min-width: 1024px)",
    largeDesktopUp: "(min-width: 1680px)"
  }
});

const { styled, globalCss, getCssText } = stitches;

export { styled, getCssText, globalCss };
