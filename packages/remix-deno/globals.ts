import { sign, unsign } from "./cookieSigning";

declare global {
  interface ProcessEnv {
    NODE_ENV: "development" | "production" | "test";
  }
  interface Process {
    env: ProcessEnv;
  }

  // This is here because we need it in our node setup,
  // but not in an actual deno project.
  /* eslint-disable prefer-let/prefer-let */
  // @ts-ignore
  var process: Process;
  /* eslint-enable prefer-let/prefer-let */
}

export function installGlobals() {
  window.sign = sign;
  window.unsign = unsign;
}
