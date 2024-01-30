import { type VitePluginAdapter, setRemixDevLoadContext } from "../plugin";

export const adapter: () => VitePluginAdapter = () => ({
  remixConfig: async () => {
    let { getBindingsProxy } = await import("wrangler");
    let { bindings } = await getBindingsProxy();
    let loadContext = bindings && { env: bindings };

    setRemixDevLoadContext(loadContext);

    return {};
  },
});
