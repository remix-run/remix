import { sign, unsign } from "./cookieSigning";

declare global {
  interface ProcessEnv {
    NODE_ENV: "development" | "production" | "test";
  }

  interface WorkerGlobalScope {
    sign: typeof sign;
    unsign: typeof unsign;
    process: { env: ProcessEnv };
  }
}

export function installGlobals() {
  self.sign = sign;
  self.unsign = unsign;
}
