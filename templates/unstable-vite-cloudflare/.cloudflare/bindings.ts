import { Miniflare } from "miniflare";
import type { WorkerOptions } from "miniflare";

import { getDOBindingInfo } from "./durable-objects";
import { getServiceBindings } from "./services";

export type DevBindingsOptions = {
  textBindings?: Record<string, string>;
  services?: Record<string, string>;
  kvNamespaces?: string[] | Record<string, string>;
  durableObjects?: Record<
    string,
    {
      scriptName: string;
      className: string;
    }
  >;
  r2Buckets?: string[] | Record<string, string>;
  d1Databases?: string[] | Record<string, string>;
  persist?: false | string;
};

export async function getCloudflareDevBindings(options: DevBindingsOptions) {
  let mf = await instantiateMiniflare(options);
  let bindings = await mf.getBindings();
  return bindings;
}

/**
 * Creates the miniflare instance that we use under the hood to provide access to bindings.
 *
 * @param options the user provided options
 * @returns the new miniflare instance.
 */
export async function instantiateMiniflare(
  options: DevBindingsOptions
): Promise<Miniflare> {
  let { workerOptions, durableObjects } =
    (await getDOBindingInfo(options.durableObjects)) ?? {};

  let { kvNamespaces, r2Buckets, d1Databases, services, textBindings } =
    options;
  let bindings = {
    bindings: textBindings,
    kvNamespaces,
    durableObjects,
    r2Buckets,
    d1Databases,
    services,
  };

  let serviceBindings = await getServiceBindings(services);

  let workers: WorkerOptions[] = [
    {
      ...bindings,
      modules: true,
      script: "",
      serviceBindings,
    },
    ...(workerOptions ? [workerOptions] : []),
  ];

  // we let the user define where to persist the data, we default back
  // to .wrangler/state/v3 which is the currently used wrangler path
  // (this is so that when they switch to wrangler pages dev they can
  // still interact with the same data)
  let persist = options?.persist ?? ".wrangler/state/v3";

  let mf = new Miniflare({
    workers,
    ...(persist === false
      ? {
          // the user specifically requested no data persistence
        }
      : {
          kvPersist: `${persist}/kv`,
          durableObjectsPersist: `${persist}/do`,
          r2Persist: `${persist}/r2`,
          d1Persist: `${persist}/d1`,
        }),
  });

  return mf;
}
