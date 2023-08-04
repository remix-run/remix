import * as path from "node:path";
import { execSync } from "node:child_process";
import * as fse from "fs-extra";
import getPort, { makeRange } from "get-port";
import prettyMs from "pretty-ms";
import NPMCliPackageJson from "@npmcli/package-json";
import { coerce } from "semver";
import pc from "picocolors";

import * as colors from "../colors";
import * as compiler from "../compiler";
import * as devServer from "../devServer";
import * as devServer_unstable from "../devServer_unstable";
import type { RemixConfig } from "../config";
import { readConfig } from "../config";
import { formatRoutes, RoutesFormat, isRoutesFormat } from "../config/format";
import { detectPackageManager } from "./detectPackageManager";
import { transpile as convertFileToJS } from "./useJavascript";
import type { Options } from "../compiler/options";
import { createFileWatchCache } from "../compiler/fileWatchCache";
import { logger } from "../tux";

type InitFlags = {
  deleteScript?: boolean;
};

export async function init(
  projectDir: string,
  { deleteScript = true }: InitFlags = {}
) {
  let initScriptDir = path.join(projectDir, "remix.init");
  let initScript = path.resolve(initScriptDir, "index.js");

  if (!(await fse.pathExists(initScript))) {
    return;
  }

  let initPackageJson = path.resolve(initScriptDir, "package.json");
  let isTypeScript = fse.existsSync(path.join(projectDir, "tsconfig.json"));
  let packageManager = detectPackageManager() ?? "npm";

  if (await fse.pathExists(initPackageJson)) {
    execSync(`${packageManager} install`, {
      cwd: initScriptDir,
      stdio: "ignore",
    });
  }

  let initFn = require(initScript);
  if (typeof initFn !== "function" && initFn.default) {
    initFn = initFn.default;
  }
  try {
    await initFn({ isTypeScript, packageManager, rootDirectory: projectDir });

    if (deleteScript) {
      await fse.remove(initScriptDir);
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      error.message = `${colors.error("🚨 Oops, remix.init failed")}\n\n${
        error.message
      }`;
    }
    throw error;
  }
}

/**
 * Keep the function around in v2 so that users with `remix setup` in a script
 * or postinstall hook can still run a build, but inform them that it's no
 * longer necessary, and we can remove it in v3.
 * @deprecated
 */
export function setup() {
  console.warn(
    "WARNING: The setup command is no longer necessary as of v2. This is a no-op. Please remove this from your dev and CI scripts, as it will be removed in v3."
  );
}

export async function routes(
  remixRoot?: string,
  formatArg?: string
): Promise<void> {
  let config = await readConfig(remixRoot);

  let format = isRoutesFormat(formatArg) ? formatArg : RoutesFormat.jsx;

  console.log(formatRoutes(config.routes, format));
}

export async function build(
  remixRoot: string,
  modeArg?: string,
  sourcemap: boolean = false
): Promise<void> {
  let mode = parseMode(modeArg) ?? "production";

  logger.info(`building...` + pc.gray(` (NODE_ENV=${mode})`));

  if (modeArg === "production" && sourcemap) {
    logger.warn("🚨  source maps enabled in production", {
      details: [
        "You are using `--sourcemap` to enable source maps in production,",
        "making your server-side code publicly visible in the browser.",
        "This is highly discouraged!",
        "If you insist, ensure that you are using environment variables for secrets",
        "and are not hard-coding them in your source.",
      ],
    });
  }

  let start = Date.now();
  let config = await readConfig(remixRoot);
  let options: Options = {
    mode,
    sourcemap,
  };
  if (mode === "development") {
    let resolved = await resolveDev(config);
    options.REMIX_DEV_ORIGIN = resolved.REMIX_DEV_ORIGIN;
  }

  let fileWatchCache = createFileWatchCache();

  fse.emptyDirSync(config.assetsBuildDirectory);
  await compiler
    .build({ config, options, fileWatchCache, logger })
    .catch((thrown) => {
      compiler.logThrown(thrown);
      process.exit(1);
    });

  logger.info("built" + pc.gray(` (${prettyMs(Date.now() - start)})`));
}

export async function watch(
  remixRootOrConfig: string | RemixConfig,
  modeArg?: string
): Promise<void> {
  let mode = parseMode(modeArg) ?? "development";
  console.log(`Watching Remix app in ${mode} mode...`);

  let config =
    typeof remixRootOrConfig === "object"
      ? remixRootOrConfig
      : await readConfig(remixRootOrConfig);

  let resolved = await resolveDev(config);
  devServer.liveReload(config, resolved);
  return await new Promise(() => {});
}

export async function dev(
  remixRoot: string,
  flags: {
    command?: string;
    manual?: boolean;
    port?: number;
    tlsKey?: string;
    tlsCert?: string;
  } = {}
) {
  console.log(`\n 💿  remix dev\n`);

  if (process.env.NODE_ENV && process.env.NODE_ENV !== "development") {
    logger.warn(`overriding NODE_ENV=${process.env.NODE_ENV} to development`);
  }
  process.env.NODE_ENV = "development";

  let config = await readConfig(remixRoot);

  let resolved = await resolveDevServe(config, flags);
  await devServer_unstable.serve(config, resolved);
}

let clientEntries = ["entry.client.tsx", "entry.client.js", "entry.client.jsx"];
let serverEntries = ["entry.server.tsx", "entry.server.js", "entry.server.jsx"];
let entries = ["entry.client", "entry.server"];

// @ts-expect-error available in node 12+
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/ListFormat#browser_compatibility
let conjunctionListFormat = new Intl.ListFormat("en", {
  style: "long",
  type: "conjunction",
});

// @ts-expect-error available in node 12+
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/ListFormat#browser_compatibility
let disjunctionListFormat = new Intl.ListFormat("en", {
  style: "long",
  type: "disjunction",
});

export async function generateEntry(
  entry: string,
  remixRoot: string,
  useTypeScript: boolean = true
) {
  let config = await readConfig(remixRoot);

  // if no entry passed, attempt to create both
  if (!entry) {
    await generateEntry("entry.client", remixRoot, useTypeScript);
    await generateEntry("entry.server", remixRoot, useTypeScript);
    return;
  }

  if (!entries.includes(entry)) {
    let entriesArray = Array.from(entries);
    let list = conjunctionListFormat.format(entriesArray);

    console.error(
      colors.error(`Invalid entry file. Valid entry files are ${list}`)
    );
    return;
  }

  let pkgJson = await NPMCliPackageJson.load(config.rootDirectory);
  let deps = pkgJson.content.dependencies ?? {};

  let maybeReactVersion = coerce(deps.react);
  if (!maybeReactVersion) {
    let react = ["react", "react-dom"];
    let list = conjunctionListFormat.format(react);
    throw new Error(
      `Could not determine React version. Please install the following packages: ${list}`
    );
  }

  let type =
    maybeReactVersion.major >= 18 || maybeReactVersion.raw === "0.0.0"
      ? ("stream" as const)
      : ("string" as const);

  let serverRuntime = deps["@remix-run/deno"]
    ? "deno"
    : deps["@remix-run/cloudflare"]
    ? "cloudflare"
    : deps["@remix-run/node"]
    ? "node"
    : undefined;

  if (!serverRuntime) {
    let serverRuntimes = [
      "@remix-run/deno",
      "@remix-run/cloudflare",
      "@remix-run/node",
    ];
    let formattedList = disjunctionListFormat.format(serverRuntimes);
    console.error(
      colors.error(
        `Could not determine server runtime. Please install one of the following: ${formattedList}`
      )
    );
    return;
  }

  let clientRenderer = deps["@remix-run/react"] ? "react" : undefined;

  if (!clientRenderer) {
    console.error(
      colors.error(
        `Could not determine runtime. Please install the following: @remix-run/react`
      )
    );
    return;
  }

  let defaultsDirectory = path.resolve(__dirname, "..", "config", "defaults");
  let defaultEntryClient = path.resolve(
    defaultsDirectory,
    `entry.client.${clientRenderer}-${type}.tsx`
  );
  let defaultEntryServer = path.resolve(
    defaultsDirectory,
    serverRuntime,
    `entry.server.${clientRenderer}-${type}.tsx`
  );

  let isServerEntry = entry === "entry.server";

  let contents = isServerEntry
    ? await createServerEntry(
        config.rootDirectory,
        config.appDirectory,
        defaultEntryServer
      )
    : await createClientEntry(
        config.rootDirectory,
        config.appDirectory,
        defaultEntryClient
      );

  let outputExtension = useTypeScript ? "tsx" : "jsx";
  let outputEntry = `${entry}.${outputExtension}`;
  let outputFile = path.resolve(config.appDirectory, outputEntry);

  if (!useTypeScript) {
    let javascript = convertFileToJS(contents, {
      cwd: config.rootDirectory,
      filename: isServerEntry ? defaultEntryServer : defaultEntryClient,
    });
    await fse.writeFile(outputFile, javascript, "utf-8");
  } else {
    await fse.writeFile(outputFile, contents, "utf-8");
  }

  console.log(
    colors.blue(
      `Entry file ${entry} created at ${path.relative(
        config.rootDirectory,
        outputFile
      )}.`
    )
  );
}

async function checkForEntry(
  rootDirectory: string,
  appDirectory: string,
  entries: string[]
) {
  for (let entry of entries) {
    let entryPath = path.resolve(appDirectory, entry);
    let exists = await fse.pathExists(entryPath);
    if (exists) {
      let relative = path.relative(rootDirectory, entryPath);
      console.error(colors.error(`Entry file ${relative} already exists.`));
      return process.exit(1);
    }
  }
}

async function createServerEntry(
  rootDirectory: string,
  appDirectory: string,
  inputFile: string
) {
  await checkForEntry(rootDirectory, appDirectory, serverEntries);
  let contents = await fse.readFile(inputFile, "utf-8");
  return contents;
}

async function createClientEntry(
  rootDirectory: string,
  appDirectory: string,
  inputFile: string
) {
  await checkForEntry(rootDirectory, appDirectory, clientEntries);
  let contents = await fse.readFile(inputFile, "utf-8");
  return contents;
}

let parseMode = (
  mode?: string
): compiler.CompileOptions["mode"] | undefined => {
  if (mode === undefined) return undefined;
  if (mode === "development") return mode;
  if (mode === "production") return mode;
  if (mode === "test") return mode;
  console.error(`Unrecognized mode: ${mode}`);
  process.exit(1);
};

let findPort = async () => getPort({ port: makeRange(3001, 3100) });

let resolveDev = async (
  config: RemixConfig,
  flags: {
    port?: number;
    tlsKey?: string;
    tlsCert?: string;
  } = {}
) => {
  let { dev } = config;

  let port = flags.port ?? dev.port ?? (await findPort());

  let tlsKey = flags.tlsKey ?? dev.tlsKey;
  if (tlsKey) tlsKey = path.resolve(tlsKey);
  let tlsCert = flags.tlsCert ?? dev.tlsCert;
  if (tlsCert) tlsCert = path.resolve(tlsCert);
  let isTLS = tlsKey && tlsCert;

  let REMIX_DEV_ORIGIN = process.env.REMIX_DEV_ORIGIN;
  if (REMIX_DEV_ORIGIN === undefined) {
    let scheme = isTLS ? "https" : "http";
    REMIX_DEV_ORIGIN = `${scheme}://localhost:${port}`;
  }

  return {
    port,
    tlsKey,
    tlsCert,
    REMIX_DEV_ORIGIN: new URL(REMIX_DEV_ORIGIN),
  };
};

let resolveDevServe = async (
  config: RemixConfig,
  flags: {
    command?: string;
    manual?: boolean;
    port?: number;
    tlsKey?: string;
    tlsCert?: string;
  } = {}
) => {
  let { dev } = config;

  let resolved = await resolveDev(config, flags);

  let command = flags.command ?? dev.command;
  let manual = flags.manual ?? dev.manual ?? false;

  return {
    ...resolved,
    command,
    manual,
  };
};
