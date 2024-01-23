import { getBindingsProxy } from "wrangler";

export const unstable_vitePluginAdapter = () => async () => {
  let { bindings } = await getBindingsProxy();
  let loadContext = bindings && { env: bindings };
  let vite = {
    // not sure why we need to exclude `fsevents`,
    // but doing so fixes esbuild errors for `fsevents.node`
    optimizeDeps: { exclude: ["fsevents"] },
    ssr: {
      resolve: {
        externalConditions: ["workerd", "worker"],
      },
    },
  };
  return { vite, loadContext };
};
