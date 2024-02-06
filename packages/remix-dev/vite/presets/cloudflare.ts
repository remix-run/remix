import { type Preset, setRemixDevLoadContext } from "../plugin";

type MaybePromise<T> = T | Promise<T>;

type GetRemixDevLoadContext = (args: {
  request: Request;
  env: Record<string, unknown>;
}) => MaybePromise<Record<string, unknown>>;

type GetLoadContext = (
  request: Request
) => MaybePromise<Record<string, unknown>>;

type GetBindingsProxy = () => Promise<{ bindings: Record<string, unknown> }>;

/**
 * @param options.getRemixDevLoadContext - Augment the load context.
 */
export const preset = (
  getBindingsProxy: GetBindingsProxy,
  options: {
    getRemixDevLoadContext?: GetRemixDevLoadContext;
  } = {}
): Preset => ({
  name: "cloudflare",
  remixConfig: async () => {
    let getLoadContext: GetLoadContext = async () => {
      let { bindings } = await getBindingsProxy();
      return { env: bindings };
    };

    // eslint-disable-next-line prefer-let/prefer-let
    const { getRemixDevLoadContext } = options;
    if (getRemixDevLoadContext) {
      getLoadContext = async (request: Request) => {
        let { bindings } = await getBindingsProxy();
        let loadContext = await getRemixDevLoadContext({
          env: bindings,
          request,
        });
        loadContext.env = {
          ...bindings,
          ...(loadContext.env ?? {}),
        };
        return loadContext;
      };
    }

    setRemixDevLoadContext(getLoadContext);
    return {};
  },
});
