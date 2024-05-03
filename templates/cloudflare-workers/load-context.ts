import { type PlatformProxy } from "wrangler";

declare module "@remix-run/cloudflare" {
  interface AppLoadContext {
    cloudflare: Omit<PlatformProxy<Env>, "dispose">;
  }
}
