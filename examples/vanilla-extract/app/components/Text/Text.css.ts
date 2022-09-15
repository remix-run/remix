/**
 * This file is a relatively basic example of what component-level
 * styling might look like. In reality we'd probably want to rely
 * on our `sprinkles` function as much as possible to reduce overall
 * CSS bundle size. However, if we need more specific styling than
 * our utility classes provide, we can do so using this pattern.
 *
 * More detail: https://vanilla-extract.style/documentation/styling
 */
import { style, styleVariants } from "@vanilla-extract/css";

export const root = style({
  fontFamily: "Comic Sans MS",
  lineHeight: "1.4",
});

// This is an example of how we can use `styleVariants`
// create a collection of styles that map to a prop value.
export const size = styleVariants({
  small: { fontSize: 24 },
  large: { fontSize: 32 },
});
