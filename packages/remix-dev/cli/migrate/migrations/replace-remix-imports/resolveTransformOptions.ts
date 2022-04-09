import inquirer from "inquirer";
import type { PackageJson } from "@npmcli/package-json";

import { error, hint } from "../../../../logging";
import type { Options } from "./transform";
import { runtimes, isRuntime, isAdapter } from "./transform";
import type {
  Adapter,
  Runtime,
} from "./transform/mapNormalizedImports/packageExports";
import { depsToEntries, isRemixPackage } from "./dependency";
import { remixSetupPattern } from "./postinstall";

const adapterToRuntime = {
  architect: "node",
  "cloudflare-pages": "cloudflare",
  "cloudflare-workers": "cloudflare",
  express: "node",
  netlify: "node",
  vercel: "node",
} as const;

const resolveRuntime = async (
  packageJson: PackageJson,
  adapter?: Adapter
): Promise<Runtime> => {
  // match `remix setup <runtime>` in `postinstall` script
  let remixSetupMatch =
    packageJson.scripts?.postinstall?.match(remixSetupPattern);
  if (remixSetupMatch && remixSetupMatch.length >= 2) {
    // `remix setup` defaults to `node
    if (remixSetupMatch[1] === undefined) return "node";

    let postinstallRuntime = remixSetupMatch[1].trim();
    if (isRuntime(postinstallRuntime)) {
      return postinstallRuntime;
    }
  }

  // @remix-run/serve uses node
  let deps = depsToEntries(packageJson.dependencies);
  let remixDeps = deps.filter(({ name }) => isRemixPackage(name));
  if (remixDeps.map(({ name }) => name).includes("@remix-run/serve")) {
    return "node";
  }
  // infer runtime from adapter
  if (adapter) return adapterToRuntime[adapter];

  // otherwise, ask user for runtime
  let { runtime } = await inquirer.prompt<{ runtime?: Runtime }>([
    {
      name: "runtime",
      message: "Which server runtime is this project using?",
      type: "list",
      pageSize: runtimes.length + 1,
      choices: [...runtimes, { name: "Nevermind...", value: undefined }],
    },
  ]);
  if (runtime === undefined) process.exit(0);
  return runtime;
};

const resolveAdapter = (packageJson: PackageJson): Adapter | undefined => {
  // find adapter in package.json dependencies
  let deps = depsToEntries(packageJson.dependencies);
  let remixDeps = deps.filter(({ name }) => isRemixPackage(name));
  let adapters = remixDeps.map(({ name }) => name).filter(isAdapter);

  if (adapters.length > 1) {
    console.error(
      error(
        `Found multiple Remix server adapters in dependencies: ${adapters.join(
          ","
        )}`
      )
    );
    console.log(
      hint(
        "You should only need one Remix server adapter. Uninstall unused server adapter packages and try again."
      )
    );
    process.exit(1);
  }

  if (adapters.length === 1) return adapters[0];

  return undefined;
};

export const resolveTransformOptions = async (
  packageJson: PackageJson
): Promise<Options> => {
  let adapter = resolveAdapter(packageJson);
  return {
    adapter,
    runtime: await resolveRuntime(packageJson, adapter),
  };
};
