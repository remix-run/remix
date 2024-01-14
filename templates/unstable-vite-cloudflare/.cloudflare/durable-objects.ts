import type { WorkerOptions } from "miniflare";

import type { DevBindingsOptions } from "./bindings";
import type { WorkerDefinition, WorkerRegistry } from "./wrangler";
import {
  EXTERNAL_DURABLE_OBJECTS_WORKER_NAME,
  EXTERNAL_DURABLE_OBJECTS_WORKER_SCRIPT,
  getIdentifier,
  getRegisteredWorkers,
} from "./wrangler";
import { warnAboutExternalBindingsNotFound } from "./utils";

/**
 * Gets information regarding DurableObject bindings that can be passed to miniflare to access external (locally exposed in the local registry) Durable Object bindings.
 *
 * @param durableObjects
 * @returns the durableObjects and WorkersOptions objects to use or undefined if connecting to the registry and/or creating the options has failed
 */
export async function getDOBindingInfo(
  durableObjects: DevBindingsOptions["durableObjects"]
): Promise<
  | {
      workerOptions: WorkerOptions;
      durableObjects: DevBindingsOptions["durableObjects"];
    }
  | undefined
> {
  let requestedDurableObjectsNames = new Set(Object.keys(durableObjects ?? {}));

  if (requestedDurableObjectsNames.size === 0) {
    return;
  }

  let registeredWorkers: WorkerRegistry | undefined;

  try {
    registeredWorkers = await getRegisteredWorkers();
  } catch {
    /* */
  }

  if (!registeredWorkers) {
    warnAboutLocalDurableObjectsNotFound(requestedDurableObjectsNames);
    return;
  }

  let registeredWorkersWithDOs: RegisteredWorkersWithDOs =
    getRegisteredWorkersWithDOs(
      registeredWorkers,
      requestedDurableObjectsNames
    );

  let [foundDurableObjects, missingDurableObjects] = [
    ...requestedDurableObjectsNames.keys(),
  ].reduce(
    ([foundDOs, missingDOs], durableObjectName) => {
      let found = false;
      for (let [, worker] of registeredWorkersWithDOs.entries()) {
        found = !!worker.durableObjects.find(
          (durableObject) => durableObject.name === durableObjectName
        );
        if (found) break;
      }
      if (found) {
        foundDOs.add(durableObjectName);
      } else {
        missingDOs.add(durableObjectName);
      }
      return [foundDOs, missingDOs];
    },
    [new Set(), new Set()] as [Set<string>, Set<string>]
  );

  if (missingDurableObjects.size) {
    warnAboutLocalDurableObjectsNotFound(missingDurableObjects);
  }

  let externalDOs = collectExternalDurableObjects(
    registeredWorkersWithDOs,
    foundDurableObjects
  );

  let script = generateDurableObjectProxyWorkerScript(
    externalDOs,
    registeredWorkersWithDOs
  );

  // the following is a very simplified version of wrangler's code but tweaked/simplified for our use case
  // https://github.com/cloudflare/workers-sdk/blob/3077016/packages/wrangler/src/dev/miniflare.ts#L240-L288
  let externalDurableObjectWorker: WorkerOptions = {
    name: EXTERNAL_DURABLE_OBJECTS_WORKER_NAME,
    routes: [`*/${EXTERNAL_DURABLE_OBJECTS_WORKER_NAME}`],
    unsafeEphemeralDurableObjects: true,
    modules: true,
    script,
  };

  let durableObjectsToUse = externalDOs.reduce((all, externalDO) => {
    return {
      ...all,
      [externalDO.durableObjectName]: externalDO,
    };
  }, {} as DevBindingsOptions["durableObjects"]);

  return {
    workerOptions: externalDurableObjectWorker,
    durableObjects: durableObjectsToUse,
  };
}

function getRegisteredWorkersWithDOs(
  registeredWorkers: WorkerRegistry,
  durableObjectsNames: Set<string>
) {
  let registeredWorkersWithDOs: Map<string, WorkerRegistry[string]> = new Map();

  for (let workerName of Object.keys(registeredWorkers ?? {})) {
    let worker = registeredWorkers![workerName]!;
    let containsRequestedDO = !!worker.durableObjects.find(({ name }) =>
      durableObjectsNames.has(name)
    );
    if (containsRequestedDO) {
      registeredWorkersWithDOs.set(workerName, worker);
    }
  }
  return registeredWorkersWithDOs;
}

/**
 * Collects information about durable objects exposed locally by the local registry that we can use to in
 * miniflare to give access such bindings.
 *
 * NOTE: This function contains logic taken from wrangler but customized and updated to our (simpler) use case
 * see: https://github.com/cloudflare/workers-sdk/blob/3077016/packages/wrangler/src/dev/miniflare.ts#L312-L330
 *
 * @param registeredWorkersWithDOs a map containing the registered workers containing Durable Objects we need to proxy to
 * @param foundDurableObjects durable objects found in the local registry
 * @returns array of objects containing durable object information (that we can use to generate the local DO proxy worker)
 */
function collectExternalDurableObjects(
  registeredWorkersWithDOs: RegisteredWorkersWithDOs,
  foundDurableObjects: Set<string>
): ExternalDurableObject[] {
  return [...registeredWorkersWithDOs.entries()]
    .flatMap(([workerName, worker]) => {
      let dos = worker.durableObjects;
      return dos.map(({ name, className }) => {
        if (!foundDurableObjects.has(name)) return undefined;

        return {
          workerName,
          durableObjectName: name,
          className: getIdentifier(`${workerName}_${className}`),
          scriptName: EXTERNAL_DURABLE_OBJECTS_WORKER_NAME,
          unsafeUniqueKey: `${workerName}-${className}`,
        };
      });
    })
    .filter(Boolean) as ExternalDurableObject[];
}

/**
 * Generates the script for a worker that can be used to proxy durable object requests to the appropriate
 * external (locally exposed in the local registry) bindings.
 *
 * NOTE: This function contains logic taken from wrangler but customized and updated to our (simpler) use case
 * see: https://github.com/cloudflare/workers-sdk/blob/3077016/packages/wrangler/src/dev/miniflare.ts#L259-L284
 *
 * @param externalDOs
 * @param registeredWorkersWithDOs a map containing the registered workers containing Durable Objects we need to proxy to
 * @returns the worker script
 */
function generateDurableObjectProxyWorkerScript(
  externalDOs: {
    workerName: string;
    className: string;
    scriptName: string;
    unsafeUniqueKey: string;
  }[],
  registeredWorkersWithDOs: RegisteredWorkersWithDOs
) {
  return (
    EXTERNAL_DURABLE_OBJECTS_WORKER_SCRIPT +
    externalDOs
      .map(({ workerName, className }) => {
        let classNameJson = JSON.stringify(className);
        let target = registeredWorkersWithDOs.get(workerName);
        if (!target || !target.host || !target.port) return undefined;
        let proxyUrl = `http://${target.host}:${target.port}/${EXTERNAL_DURABLE_OBJECTS_WORKER_NAME}`;
        let proxyUrlJson = JSON.stringify(proxyUrl);
        return `export const ${className} = createClass({ className: ${classNameJson}, proxyUrl: ${proxyUrlJson} });`;
      })
      .filter(Boolean)
      .join("\n")
  );
}

type RegisteredWorkersWithDOs = Map<string, WorkerDefinition>;

type ExternalDurableObject = {
  workerName: string;
  durableObjectName: string;
  className: string;
  scriptName: string;
  unsafeUniqueKey: string;
};

function warnAboutLocalDurableObjectsNotFound(
  durableObjectsNotFound: Set<string>
): void {
  warnAboutExternalBindingsNotFound(durableObjectsNotFound, "Durable Objects");
}
