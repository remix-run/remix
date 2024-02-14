import { type KVNamespace } from "@cloudflare/workers-types";
import { type PlatformProxy } from "wrangler";

// TODO: generate Env via `wrangler types`
type Env = { MY_KV: KVNamespace };
type Cloudflare = Omit<PlatformProxy<Env>, "dispose">;

declare module "@remix-run/cloudflare" {
  interface AppLoadContext {
    cloudflare: Cloudflare;
  }
}
