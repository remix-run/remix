import type {
  InternalSignFunctionDoNotUseMe,
  InternalUnsignFunctionDoNotUseMe
} from "@remix-run/server-runtime/cookieSigning";
import cookieSignature from "cookie-signature";

export const sign: InternalSignFunctionDoNotUseMe = async (value, secret) => {
  return cookieSignature.sign(value, secret);
};

export const unsign: InternalUnsignFunctionDoNotUseMe = async (
  signed: string,
  secret: string
) => {
  return cookieSignature.unsign(signed, secret);
};
