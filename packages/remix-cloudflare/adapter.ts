import { getBindingsProxy } from "wrangler";

export const adapter = () => async () => {
  let { bindings } = await getBindingsProxy();
  let loadContext = bindings && { env: bindings };
  return { loadContext };
};
