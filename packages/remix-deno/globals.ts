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
  // @ts-ignore
  var process: Process;
}

export function installGlobals() {
  window.sign = sign;
  window.unsign = unsign;
}
