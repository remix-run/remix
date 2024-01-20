import { getBindingsProxy } from "wrangler";

export const adapter = () => async () => {
  const { bindings } = await getBindingsProxy();
  let loadContext = bindings && { env: bindings };
  return { loadContext };
};
