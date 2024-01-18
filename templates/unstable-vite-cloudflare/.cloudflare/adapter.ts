import { DevBindingsOptions, getBindingsProxy } from "./bindings";

export const adapter =
  (options?: { bindings: DevBindingsOptions }) => async () => {
    let bindings: Record<string, unknown> | undefined;
    if (options?.bindings) {
      bindings = await getBindingsProxy(options.bindings);
    }
    let loadContext = bindings && { env: bindings };
    return { loadContext };
  };
