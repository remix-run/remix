import "./globals";

const alreadyWarned: Record<string, boolean> = {};
const warnOnce = (message: string, key = message) => {
  if (!alreadyWarned[key]) {
    alreadyWarned[key] = true;
    console.warn(message);
  }
};

warnOnce(
  "⚠️ REMIX FUTURE CHANGE: The `@remix-run/vercel` runtime adapter " +
    "has been deprecated in favor of out of the box Vercel functionality and " +
    "will be removed in Remix v2. Please update your code by removing " +
    "`@remix-run/vercel` & `@vercel/node` from your `package.json`, removing " +
    "your `server.js`/`server.ts` file, and removing the `server` & " +
    "`serverBuildPath` options from your `remix.config.js`.",
  "built-in-vercel-functionality"
);

export type { GetLoadContextFunction, RequestHandler } from "./server";
export { createRequestHandler } from "./server";
