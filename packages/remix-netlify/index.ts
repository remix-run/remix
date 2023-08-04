import "./globals";

const alreadyWarned: Record<string, boolean> = {};
const warnOnce = (message: string, key = message) => {
  if (!alreadyWarned[key]) {
    alreadyWarned[key] = true;
    console.warn(message);
  }
};

warnOnce(
  "⚠️ REMIX FUTURE CHANGE: The `@remix-run/netlify` runtime adapter " +
    "has been deprecated in favor of `@netlify/remix-adapter` and will be " +
    "removed in Remix v2. Please update your code by changing all " +
    "`@remix-run/netlify` imports to `@netlify/remix-adapter`.\n Keep in " +
    "mind that `@netlify/remix-adapter` requires `@netlify/functions@^1.0.0`, " +
    "which is a breaking change compared to the current supported " +
    "`@netlify/functions` versions in `@remix-run/netlify`." +
    "official-netlify-adapter"
);

export type { GetLoadContextFunction, RequestHandler } from "./server";
export { createRequestHandler } from "./server";
