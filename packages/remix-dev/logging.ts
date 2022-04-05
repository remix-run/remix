import * as colors from "./colors";

export function log(...args: any) {
  console.log(...args);
}

export const hint = (message: string) =>
  console.log(colors.hint("HINT: ") + message);

export const deprecation = (message: string) => {
  console.log(colors.warning("DEPRECATION: ") + message);
};
