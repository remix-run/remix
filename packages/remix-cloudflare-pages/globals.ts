import { sign, unsign } from "./cookieSigning";

declare global {
  interface WorkerGlobalScope {
    sign: typeof sign;
    unsign: typeof unsign;
  }
}

export function installGlobals() {
  self.sign = sign;
  self.unsign = unsign;
}
