import { sign, unsign } from "./cookieSigning.ts";

/* eslint-disable prefer-let/prefer-let */
declare global {
  interface ProcessEnv {
    NODE_ENV: "development" | "production" | "test";
  }
  interface Process {
    env: ProcessEnv;
  }

  // This is here because we need it in our node setup,
  // but not in an actual deno project.
  // deno-lint-ignore no-var
  var process: Process;
}
/* eslint-enable prefer-let/prefer-let */

export function installGlobals() {
  window.sign = sign;
  window.unsign = unsign;
}
