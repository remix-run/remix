/**
 * This file is configuration for Sprinkles, a library built on
 * top of vanilla-extract for generating type-safe utility classes.
 * The generated `sprinkles` function can be used at build time in
 * `.css.ts` files, but importantly, it can also be used at runtime
 * since it doesn't generate CSS on demand. Instead, it returns a
 * string of class names that reference styles that have already
 * been generated.
 *
 * More detail: https://vanilla-extract.style/documentation/packages/sprinkles
 */
import { defineProperties, createSprinkles } from "@vanilla-extract/sprinkles";

// This space scale is a basic example for demo purposes.
// We're free to use whatever naming convention we like,
// or even none at all! e.g. `"4px": "4px"`, etc.
const space = {
  none: 0,
  small: "4px",
  medium: "8px",
  large: "16px",
  // etc.
};

// Same as above, this color palette is just a basic example.
// Values like these can also be hooked up to themes using CSS variables.
// More detail: https://vanilla-extract.style/documentation/theming
const colors = {
  lightBlue: "#bfdbfe",
  darkGray: "#1f2937",
  // etc.
};

const responsiveProperties = defineProperties({
  conditions: {
    // This is a basic example of responsive conditions, but these conditions
    // can be named and customized however we like. We can even scope our
    // conditions to selectors and feature/container queries!
    // More detail: https://vanilla-extract.style/documentation/packages/sprinkles/#conditions
    mobile: {},
    tablet: { "@media": "screen and (min-width: 768px)" },
    desktop: { "@media": "screen and (min-width: 1024px)" },
  },
  // The default condition is applied when non-conditional values are used,
  // e.g. `sprinkles({ padding: 'small' })` is equivalent to writing
  // `sprinkles({ padding: { mobile: 'small' }}) since it's mobile-first.
  defaultCondition: "mobile",

  // Sprinkles generates a separate class for each property
  // value at each condition, allowing us to dynamically
  // select them in a type-safe way at runtime.
  properties: {
    // By defining these values in an array format, we're
    // configuring them to simply map through to the usual
    // CSS values rather than using a custom naming convention,
    // e.g. `sprinkles({ display: 'flex' })`
    display: ["none", "flex", "block", "inline"],
    flexDirection: ["row", "column"],
    justifyContent: [
      "stretch",
      "flex-start",
      "center",
      "flex-end",
      "space-around",
      "space-between",
    ],
    alignItems: ["stretch", "flex-start", "center", "flex-end"],

    // Here we're applying our space scale to `gap` and `padding`
    // properties via our `space` object. This allows us to
    // provide our own semantic naming convention,
    // e.g. `sprinkles({ paddingTop: 'small' })`
    gap: space,
    paddingTop: space,
    paddingBottom: space,
    paddingLeft: space,
    paddingRight: space,
    // etc.
  },
  shorthands: {
    // Shorthands allow us to use a single property to apply multiple
    // utility classes at once, e.g. `sprinkles({ padding: 'small' })` maps
    // to `sprinkles({ paddingTop: 'small', paddingBottom: 'small', ...etc })`
    padding: ["paddingTop", "paddingBottom", "paddingLeft", "paddingRight"],
    paddingX: ["paddingLeft", "paddingRight"],
    paddingY: ["paddingTop", "paddingBottom"],
    placeItems: ["justifyContent", "alignItems"],
  },
});

// These properties are defined separately from `responsiveProperties`
// because they're being configured with different conditions.
const colorProperties = defineProperties({
  conditions: {
    lightMode: {},
    darkMode: { "@media": "(prefers-color-scheme: dark)" },
  },
  defaultCondition: "lightMode",
  properties: {
    color: colors,
    background: colors,
  },
});

// Here we combine all of our properties into a single `sprinkles` function
export const sprinkles = createSprinkles(responsiveProperties, colorProperties);

// It's a good idea to export the Sprinkles type too
export type Sprinkles = Parameters<typeof sprinkles>[0];
