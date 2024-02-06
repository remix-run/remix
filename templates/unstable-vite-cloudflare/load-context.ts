import type { KVNamespace } from "@cloudflare/workers-types";
import { type AppLoadContext } from "@remix-run/cloudflare";

// In the future, types for bindings will be generated by `wrangler types`
// See https://github.com/cloudflare/workers-sdk/pull/4931
type Bindings = {
  // Add types for bindings configured in `wrangler.toml`
  MY_KV: KVNamespace;
};

declare module "@remix-run/cloudflare" {
  interface AppLoadContext {
    env: Bindings;
    // extra: string; // Example of augmenting load context
  }
}

// Subset of Cloudflare context supported by `getBindingsProxy` for use in Node-based environments like Vite
// The Cloudflare team is working to improve their Node proxies to support:
// - https://github.com/cloudflare/workers-sdk/issues/4875
// - https://github.com/cloudflare/workers-sdk/issues/4876
// - https://github.com/cloudflare/workers-sdk/issues/4879
type Context = { request: Request; env: Bindings };

// Shared implementation compatible with Vite, Wrangler, and Cloudflare Pages
export const getLoadContext = async (
  context: Context
): Promise<AppLoadContext> => {
  return {
    ...context,
    // extra: "stuff", // Example of augmenting load context
  };
};
