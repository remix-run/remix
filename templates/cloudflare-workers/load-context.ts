import { type PlatformProxy } from "wrangler";

// PlatformProxy’s caches property is incompatible with the caches global
// https://github.com/cloudflare/workers-sdk/blob/main/packages/wrangler/src/api/integrations/platform/caches.ts
type Cloudflare = Omit<PlatformProxy<Env>, "dispose" | "caches"> & {
  caches: CacheStorage;
};

declare module "@remix-run/cloudflare" {
  interface AppLoadContext {
    cloudflare: Cloudflare;
  }
}
