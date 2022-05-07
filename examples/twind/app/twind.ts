import { setup } from "@twind/tailwind";

// Exporting a function to call setup() to avoid module side effects
// https://remix.run/docs/en/v1/guides/constraints#no-module-side-effects
export function setupTwind() {
  setup()
}