import { sign, unsign } from "./cookieSigning";

export function installGlobals() {
  window.sign = sign;
  window.unsign = unsign;
}
