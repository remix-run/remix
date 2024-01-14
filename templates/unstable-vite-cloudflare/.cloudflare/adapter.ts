// Eventually, `getCloudflareDevBindings` will be replaced by the official `getBindingsProxy` API from CloudFlare
// https://github.com/cloudflare/workers-sdk/pull/4523
// At that point, Remix will absorb this adapter so you can import it directly in your `vite.config.ts`:
//
//   import { adapter as cloudflare } from "@remix-run/cloudflare"
//
// Until then, this `.cloudflare/` directory provides the adapter implementation.
import { DevBindingsOptions, getCloudflareDevBindings } from "./bindings";

export const adapter =
  (options?: { bindings: DevBindingsOptions }) => async () => {
    let bindings: Record<string, unknown> | undefined;
    if (options?.bindings) {
      bindings = await getCloudflareDevBindings(options.bindings);
    }
    let loadContext = bindings && { env: bindings };
    return { loadContext };
  };
