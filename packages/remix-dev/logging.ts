import * as colors from "./colors";

export function log(...args: any) {
  console.log(...args);
}

export const error = (message: string) => colors.error("ERROR: ") + message;

export const hint = (message: string) => colors.hint("HINT: ") + message;

export const deprecation = (message: string) =>
  colors.warning("DEPRECATION: ") + message;
