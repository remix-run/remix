import fse from "fs-extra";
import path from "node:path";

import { tryLoadPackageJson } from "./tryLoadPackageJson";

type ServerRuntime = "cloudflare" | "deno" | "node";

let disjunctionListFormat = new Intl.ListFormat("en", {
  style: "long",
  type: "disjunction",
});

let denoConfigFilenames = ["deno.json", "deno.jsonc"];

const isDenoProject = (dir: string) => {
  for (let configFilename of denoConfigFilenames) {
    let file = path.resolve(dir, configFilename);
    if (fse.existsSync(file)) return true;
  }

  return false;
};

export const detectServerRuntime = async (
  rootDirectory: string,
  deps?: Partial<Record<string, string>>
): Promise<ServerRuntime> => {
  if (isDenoProject(rootDirectory)) {
    return "deno";
  }

  if (!deps) {
    let pkgJson = await tryLoadPackageJson(rootDirectory);
    deps = pkgJson?.content.dependencies ?? {};
  }

  let serverRuntime: ServerRuntime | undefined = deps["@remix-run/deno"]
    ? "deno"
    : deps["@remix-run/cloudflare"]
    ? "cloudflare"
    : deps["@remix-run/node"]
    ? "node"
    : undefined;

  if (!serverRuntime) {
    let serverRuntimes = [
      "@remix-run/cloudflare",
      "@remix-run/deno",
      "@remix-run/node",
    ];
    let formattedList = disjunctionListFormat.format(serverRuntimes);
    throw new Error(
      `Could not determine server runtime. Please install one of the following: ${formattedList}.`
    );
  }

  return serverRuntime;
};
