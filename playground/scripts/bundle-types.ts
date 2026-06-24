import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

// Builds a single `app/generated/types.ts` module that exports a
// `remixTypes` string. The string contains the bundled type definitions for the
// `remix` package and each of its export subpaths, wrapped in
// `declare module "remix/..."` blocks so they can be fed to an in-browser
// TypeScript language service (e.g. Monaco) for the playground.
//
// Identity matters. The `remix/*` subpaths are thin `export * from
// '@remix-run/*'` wrappers, and many of those `@remix-run/*` packages share
// types (`RequestContext`, `Middleware`, `Route`, the `contextTransform` unique
// symbol, etc.). If we *inlined* a private copy of those shared types into every
// `remix/*` module, each copy would be a nominally-distinct type, so e.g. the
// `Middleware` returned by `remix/middleware/render` would not be assignable to
// the `AnyMiddleware` expected by `remix/router` — and declaration merges like
// `context.render` would silently disappear.
//
// So instead of inlining, we bundle each `@remix-run/*` package exactly once
// into its own `declare module "@remix-run/*"` block (keeping cross-package
// imports as plain `import ... from '@remix-run/*'` references) and emit the
// `remix/*` subpaths as re-export wrappers. Every subpath then resolves to the
// same underlying type identity, exactly like the real package does on disk.
//
// UI is the exception: `remix/ui` ships an ambient `declare global { namespace
// JSX }` augmentation plus tightly-coupled `css`/mixin types, and it is fed to
// the language service via separate `addExtraLib` calls. We keep the existing
// self-contained inlining for the UI subpaths (see further down).

const require = createRequire(import.meta.url);
const ts = require("typescript") as typeof import("typescript");
const { generateDtsBundle } = require(
  "dts-bundle-generator",
) as typeof import("dts-bundle-generator");

// Some published `@remix-run/*` declaration files contain dynamic-import type
// references that point back into a sibling package's *source* tree, e.g.
// `import("../../../fetch-router/src/lib/request-context.ts")`. Following those
// pulls raw `.ts` sources into the program, which both bloats the bundle and
// makes dts-bundle-generator throw on certain source constructs. Patch the
// shared file reader so those references resolve to the matching `dist/*.d.ts`
// declaration files instead. This is in-memory only; nothing on disk changes.
const originalReadFile = ts.sys.readFile;
ts.sys.readFile = (filePath, encoding) => {
  const contents = originalReadFile(filePath, encoding);
  if (
    contents != null && filePath.endsWith(".d.ts") && contents.includes("/src/")
  ) {
    return contents.replace(/\/src\/([^"']*?)\.ts/g, "/dist/$1.d.ts");
  }
  return contents;
};

const projectRoot = process.cwd();
const remixDir = fs.realpathSync(path.join(projectRoot, "node_modules/remix"));
const remixPkg = JSON.parse(
  fs.readFileSync(path.join(remixDir, "package.json"), "utf8"),
) as {
  name: string;
  dependencies: Record<string, string>;
  exports: Record<string, string | { types?: string; default?: string }>;
};

// `@remix-run/*` packages are dependencies of `remix`, so resolve them relative
// to the `remix` package rather than the project root (pnpm hoisting aside).
const remixRequire = createRequire(path.join(remixDir, "package.json"));
// Use a dedicated tsconfig (not the project one) for dts-bundle-generator. The
// project tsconfig registers Cloudflare's worker types via
// `types: ["./worker-configuration.d.ts"]`, whose global `Element` (HTMLRewriter)
// shadows the DOM `Element`. With that config the bundler resolves the `Element`
// referenced by remix/ui's mixin/`css` types to the Cloudflare one and inlines
// it, which breaks `mix`/`css` assignability in the playground. The bundle
// config keeps `Element` as the DOM `Element` and excludes Cloudflare types.
const preferredConfigPath = path.join(
  projectRoot,
  "scripts/tsconfig.bundle.json",
);

// Inline the types of every first-party `@remix-run/*` dependency. Only used for
// the self-contained UI bundles below; non-UI modules share a single identity.
const inlinedLibraries = Object.keys(remixPkg.dependencies).filter((name) =>
  name.startsWith("@remix-run/")
);

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

// Triple-slash reference directives must live at the top of the file, never
// inside a `declare module` block, so we hoist them out and de-duplicate.
const references = new Set<string>();
const referencePattern = /^\s*\/\/\/\s*<reference\b.*?\/>\s*$/;
const sourceMapPattern = /^\s*\/\/#\s*sourceMappingURL=.*$/;

// Strip triple-slash references (collecting them into `references`) and source
// map comments out of a bundle, then indent the remaining lines for nesting
// inside a `declare module` block.
function prepareModuleBody(
  bundle: string,
  refs: Set<string> = references,
): string {
  const bodyLines: string[] = [];
  for (const line of bundle.split("\n")) {
    if (referencePattern.test(line)) {
      refs.add(line.trim());
      continue;
    }
    if (sourceMapPattern.test(line)) continue;
    bodyLines.push(line);
  }

  return bodyLines
    .join("\n")
    .trim()
    .split("\n")
    .map((line) => (line.length > 0 ? `  ${line}` : line))
    .join("\n");
}

function packageOf(specifier: string): string {
  return specifier.match(/^(@[^/]+\/[^/]+)/)![1];
}

type PackageMeta = {
  dir: string;
  types?: string;
  typings?: string;
  exports?: Record<string, unknown>;
};

const packageMetaCache = new Map<string, PackageMeta | undefined>();
function readPackageMeta(pkg: string): PackageMeta | undefined {
  if (packageMetaCache.has(pkg)) return packageMetaCache.get(pkg);
  let packageJsonPath: string | undefined;
  try {
    // Most packages export `./package.json`.
    packageJsonPath = remixRequire.resolve(`${pkg}/package.json`);
  } catch {
    // Some packages (e.g. `@standard-schema/spec`) restrict their `exports`
    // map and don't expose `./package.json`. Resolve the bare entry instead
    // and walk up to the nearest `package.json` whose name matches.
    try {
      let dir = path.dirname(remixRequire.resolve(pkg));
      while (true) {
        const candidate = path.join(dir, "package.json");
        if (fs.existsSync(candidate)) {
          const name = JSON.parse(fs.readFileSync(candidate, "utf8"))?.name;
          if (name === pkg) {
            packageJsonPath = candidate;
            break;
          }
        }
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
    } catch { /* fall through to undefined below */ }
  }
  if (!packageJsonPath) {
    packageMetaCache.set(pkg, undefined);
    return undefined;
  }
  const meta = JSON.parse(
    fs.readFileSync(packageJsonPath, "utf8"),
  ) as PackageMeta;
  meta.dir = path.dirname(packageJsonPath);
  packageMetaCache.set(pkg, meta);
  return meta;
}

function typesOfExport(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const e = value as {
      types?: string;
      import?: { types?: string };
      default?: string;
    };
    return e.types ?? e.import?.types ?? e.default;
  }
  return undefined;
}

// Split any bare module specifier into its package name and subpath export key
// (`.` for the bare package). Handles both scoped (`@scope/name/sub`) and
// unscoped (`name/sub`) specifiers.
function splitSpecifier(
  specifier: string,
): { pkg: string; subpath: string } | undefined {
  const match = specifier.match(/^(@[^/]+\/[^/]+|[^/]+)(\/.*)?$/);
  if (!match) return undefined;
  return { pkg: match[1], subpath: match[2] ? `.${match[2]}` : "." };
}

// Resolve the `.d.ts` types entry for any bare specifier, including subpath
// exports like `@remix-run/route-pattern/href` or `mysql2/promise`.
function resolveTypesEntry(specifier: string): string | undefined {
  const split = splitSpecifier(specifier);
  if (!split) return undefined;
  const { pkg, subpath } = split;

  const meta = readPackageMeta(pkg);
  if (!meta) return undefined;

  let types = typesOfExport(meta.exports?.[subpath]);
  if (!types && subpath === ".") types = meta.types ?? meta.typings;
  if (!types) return undefined;

  const resolved = path.resolve(meta.dir, types);
  return fs.existsSync(resolved) ? resolved : undefined;
}

// Back-compat alias: `@remix-run/*` callers use the same generic resolver.
const resolveRemixRunTypes = resolveTypesEntry;

// Every `@remix-run/*` subpath specifier a package declares in its `exports`
// map that ships a resolvable types entry (always includes the bare package).
function declaredSpecifiers(pkg: string): string[] {
  const meta = readPackageMeta(pkg);
  if (!meta) return [];
  const specifiers = new Set<string>();
  for (const [sub, value] of Object.entries(meta.exports ?? {})) {
    if (sub === "./package.json") continue;
    if (!typesOfExport(value)) continue;
    specifiers.add(sub === "." ? pkg : `${pkg}${sub.slice(1)}`);
  }
  if (specifiers.size === 0 && (meta.types || meta.typings)) {
    specifiers.add(pkg);
  }
  return [...specifiers];
}

// Collect every `@remix-run/*` module specifier referenced by `import`/`export`
// statements in a bundle (used to walk the dependency graph).
function remixRunSpecifiers(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(/\bfrom\s+['"](@remix-run\/[^'"]+)['"]/g)) {
    found.add(m[1]);
  }
  for (const m of text.matchAll(/\bimport\s+['"](@remix-run\/[^'"]+)['"]/g)) {
    found.add(m[1]);
  }
  for (
    const m of text.matchAll(/\bimport\(\s*['"](@remix-run\/[^'"]+)['"]\s*\)/g)
  ) found.add(m[1]);
  return [...found];
}

// Collect every *external* bare module specifier referenced by `import`/`export`
// statements in a bundle that we don't already declare elsewhere: not relative,
// not a `node:` builtin, not `@remix-run/*` (canonical blocks) and not `remix/*`
// (wrapper blocks). These are third-party type dependencies (e.g.
// `@standard-schema/spec`, `pg`) that dts-bundle-generator keeps as external
// references, so the language service needs a `declare module` for them too.
function externalSpecifiers(text: string): string[] {
  const found = new Set<string>();
  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/g,
    /\bimport\s+['"]([^'"]+)['"]/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const m of text.matchAll(pattern)) {
      const spec = m[1];
      if (spec.startsWith(".")) continue;
      if (spec.startsWith("node:")) continue;
      if (spec === "remix" || spec.startsWith("remix/")) continue;
      if (spec.startsWith("@remix-run/")) continue;
      found.add(spec);
    }
  }
  return [...found];
}

// ---------------------------------------------------------------------------
// Categorize `remix/*` export subpaths
// ---------------------------------------------------------------------------

type ExportEntry = {
  specifier: string;
  subpath: string;
  filePath: string;
  /** Raw `.d.ts` text of the (thin) wrapper module. */
  source: string;
  /** `@remix-run/*` specifier this wrapper re-exports, if any. */
  reexport: string | undefined;
  isUI: boolean;
};

const exportEntries: ExportEntry[] = [];
for (const [subpath, value] of Object.entries(remixPkg.exports)) {
  if (subpath === "./package.json") continue;
  const types = typeof value === "object" ? value.types : undefined;
  if (!types) continue;

  const filePath = path.resolve(remixDir, types);
  if (!fs.existsSync(filePath)) {
    console.warn(`skipping ${subpath}: missing types file ${types}`);
    continue;
  }

  const source = fs.readFileSync(filePath, "utf8");
  const specifier = subpath === "."
    ? remixPkg.name
    : `${remixPkg.name}/${subpath.replace(/^\.\//, "")}`;
  const targets = remixRunSpecifiers(source);
  const reexport = targets[0];
  const isUI = targets.some((t) =>
    t === "@remix-run/ui" || t.startsWith("@remix-run/ui/")
  );

  exportEntries.push({ specifier, subpath, filePath, source, reexport, isUI });
}

const uiEntries = exportEntries.filter((e) => e.isUI);
const nonUiEntries = exportEntries.filter((e) => !e.isUI);

// ---------------------------------------------------------------------------
// Bundle each `@remix-run/*` package once (shared identity, non-UI graph)
// ---------------------------------------------------------------------------

const isUiSpecifier = (specifier: string) =>
  specifier === "@remix-run/ui" || specifier.startsWith("@remix-run/ui/");

// Bundle a whole package in one pass so types shared across its subpaths (e.g.
// `Route` between `@remix-run/fetch-router` and `@remix-run/fetch-router/routes`)
// are emitted once and keep a single identity. The synthetic entry re-exports
// every declared subpath; only this package's own files are inlined, so sibling
// `@remix-run/*` imports stay external and resolve to their own shared module.
function bundlePackage(pkg: string): string | undefined {
  const meta = readPackageMeta(pkg);
  if (!meta) return undefined;
  const specifiers = declaredSpecifiers(pkg).filter((s) =>
    resolveRemixRunTypes(s)
  );
  if (specifiers.length === 0) return undefined;

  const entryFile = path.join(
    meta.dir,
    `__remix_canonical_entry_${Date.now()}.d.ts`,
  );
  fs.writeFileSync(
    entryFile,
    specifiers.map((s) => `export * from '${s}';`).join("\n") + "\n",
  );
  try {
    const [bundle] = generateDtsBundle(
      [
        {
          filePath: entryFile,
          libraries: { inlinedLibraries: [pkg] },
          output: { noBanner: true, inlineDeclareGlobals: true },
        },
      ],
      { preferredConfigPath },
    );
    return bundle;
  } finally {
    fs.rmSync(entryFile, { force: true });
  }
}

// Walk the `@remix-run/*` dependency graph package-by-package. `canonicalByPackage`
// holds one bundle per package; `referencedSpecifiers` tracks every subpath we
// must emit a re-export alias for.
const canonicalByPackage = new Map<string, string>();
const referencedSpecifiers = new Set<string>();
const sharedFailures: { specifier: string; error: string }[] = [];

const seedSpecifiers = [
  ...new Set(nonUiEntries.flatMap((e) => remixRunSpecifiers(e.source))),
];
const packageQueue: string[] = [];
const packageSeen = new Set<string>();
for (const spec of seedSpecifiers) {
  if (isUiSpecifier(spec)) continue;
  referencedSpecifiers.add(spec);
  const pkg = packageOf(spec);
  if (!packageSeen.has(pkg)) {
    packageSeen.add(pkg);
    packageQueue.push(pkg);
  }
}

console.log(
  `bundling @remix-run/* dependency graph (seed: ${packageQueue.length} packages)...`,
);

while (packageQueue.length > 0) {
  const pkg = packageQueue.shift()!;
  if (isUiSpecifier(pkg)) continue;

  const startedAt = Date.now();
  let bundle: string | undefined;
  try {
    bundle = bundlePackage(pkg);
  } catch (error) {
    const message = error instanceof Error
      ? error.message.split("\n")[0]
      : String(error);
    sharedFailures.push({ specifier: pkg, error: message });
    console.warn(`  ${pkg} FAILED: ${message}`);
    continue;
  }
  if (bundle == null) {
    sharedFailures.push({
      specifier: pkg,
      error: "could not resolve types entry",
    });
    continue;
  }

  canonicalByPackage.set(pkg, bundle);
  for (const spec of declaredSpecifiers(pkg)) referencedSpecifiers.add(spec);
  console.log(`  ${pkg} (${Date.now() - startedAt}ms)`);

  for (const next of remixRunSpecifiers(bundle)) {
    if (isUiSpecifier(next)) continue;
    referencedSpecifiers.add(next);
    const nextPkg = packageOf(next);
    if (!packageSeen.has(nextPkg)) {
      packageSeen.add(nextPkg);
      packageQueue.push(nextPkg);
    }
  }
}

// ---------------------------------------------------------------------------
// Bundle third-party (non-`@remix-run`) type dependencies
// ---------------------------------------------------------------------------
//
// The canonical `@remix-run/*` bundles keep references to third-party packages
// (e.g. `@standard-schema/spec`, which `@remix-run/data-schema` re-exports for
// `InferInput`/`InferOutput`) as plain external imports. Without a matching
// `declare module`, the in-browser language service resolves those imports to
// `any`, so generics like `s.InferOutput<typeof Schema>` silently collapse to
// `undefined`/`never`. Bundle each referenced external package once (inlining
// only itself) and emit a `declare module` block for it.
const externalByModule = new Map<string, string>();
const externalFailures: { specifier: string; error: string }[] = [];

// `remix/*` wrapper sources can also reference externals directly.
const externalSeed = new Set<string>();
for (const bundle of canonicalByPackage.values()) {
  for (const spec of externalSpecifiers(bundle)) externalSeed.add(spec);
}
for (const entry of nonUiEntries) {
  for (const spec of externalSpecifiers(entry.source)) externalSeed.add(spec);
}

if (externalSeed.size > 0) {
  console.log(
    `bundling ${externalSeed.size} external type dependenc${
      externalSeed.size === 1 ? "y" : "ies"
    }...`,
  );
}

for (const specifier of [...externalSeed].sort()) {
  const typesEntry = resolveTypesEntry(specifier);
  if (!typesEntry) {
    externalFailures.push({
      specifier,
      error: "could not resolve types entry",
    });
    continue;
  }
  const pkg = splitSpecifier(specifier)!.pkg;
  const startedAt = Date.now();
  try {
    const [bundle] = generateDtsBundle(
      [
        {
          filePath: typesEntry,
          libraries: { inlinedLibraries: [pkg] },
          output: { noBanner: true, inlineDeclareGlobals: true },
        },
      ],
      { preferredConfigPath },
    );
    externalByModule.set(specifier, bundle);
    console.log(`  ${specifier} (${Date.now() - startedAt}ms)`);
  } catch (error) {
    const message = error instanceof Error
      ? error.message.split("\n")[0]
      : String(error);
    externalFailures.push({ specifier, error: message });
    console.warn(`  ${specifier} FAILED: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// Bundle the UI subpaths (self-contained inlining, as before)
// ---------------------------------------------------------------------------

// The ambient `declare global { namespace JSX }` augmentation that powers JSX
// type-checking lives in remix's UI runtime. dts-bundle-generator tree-shakes
// `declare global` blocks out of inlined libraries unless `inlineDeclareGlobals`
// is set, so opt in for exactly one file.
//
// We attach it to `remix/ui` (not `remix/ui/jsx-runtime`) on purpose: `remix/ui`
// re-exports the same UI runtime module that defines the JSX namespace, so the
// inlined `JSX.IntrinsicElements` and the `css`/`clientEntry`/mixin types end up
// in a single `declare module` scope and therefore share type identity. Splitting
// them across modules duplicates types like `MixinDescriptor`/`CSSProps` and
// breaks assignability (e.g. `mix={css(...)}`). Enabling it everywhere would
// instead duplicate the global JSX namespace and trip "duplicate identifier".
const uiTypes = (remixPkg.exports["./ui"] as { types?: string })?.types;
const globalsFilePath = uiTypes ? path.resolve(remixDir, uiTypes) : undefined;

const uiBundleByFile = new Map<string, string>();
const uiFailures: { filePath: string; error: string }[] = [];
const uniqueUiFiles = [...new Set(uiEntries.map((e) => e.filePath))];

console.log(`bundling ${uniqueUiFiles.length} UI type files...`);

for (const filePath of uniqueUiFiles) {
  const label = path.relative(remixDir, filePath);
  const startedAt = Date.now();
  try {
    const [bundle] = generateDtsBundle(
      [
        {
          filePath,
          libraries: { inlinedLibraries },
          output: {
            noBanner: true,
            inlineDeclareGlobals: filePath === globalsFilePath,
          },
        },
      ],
      { preferredConfigPath },
    );
    uiBundleByFile.set(filePath, bundle);
    console.log(`  ${label} (${Date.now() - startedAt}ms)`);
  } catch (error) {
    const message = error instanceof Error
      ? error.message.split("\n")[0]
      : String(error);
    uiFailures.push({
      filePath: path.relative(projectRoot, filePath),
      error: message,
    });
    console.warn(`  ${label} FAILED: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// Assemble the combined `remixTypes` bundle
// ---------------------------------------------------------------------------

// Build a `remix/*` re-export wrapper. The wrapper source is tiny (usually a
// single `export * from '@remix-run/*'`). We emit it almost verbatim, including
// any nested `declare module '@remix-run/*' { ... }` augmentation (e.g. the
// `RouterTypes` bridge in `remix/router`). Keeping that augmentation *nested*
// matters: it references the wrapper's module-local alias (`RemixRouterTypes`),
// which disambiguates the wrapper's own `RouterTypes` from the one re-exported
// via `export *`. Hoisting it to the file root breaks that and silently drops
// the user's `declare module "remix/router" { interface RouterTypes }` merge.
function buildWrapperModule(entry: ExportEntry): string | undefined {
  if (entry.reexport && !canonicalByPackage.has(packageOf(entry.reexport))) {
    // The target package failed to bundle; skip rather than emit a dangling
    // re-export that resolves to `any`.
    return undefined;
  }

  const body = prepareModuleBody(entry.source);
  return `declare module "${entry.specifier}" {\n${body}\n}`;
}

const moduleBlocks: string[] = [];

// 1. Canonical `@remix-run/*` package modules (single identity for everyone).
for (const [pkg, bundle] of canonicalByPackage) {
  moduleBlocks.push(
    `declare module "${pkg}" {\n${prepareModuleBody(bundle)}\n}`,
  );
}

// 1b. Subpath aliases (`@remix-run/pkg/sub`) re-export the canonical package so
// every subpath resolves to the same types the package already declared.
for (const specifier of [...referencedSpecifiers].sort()) {
  const pkg = packageOf(specifier);
  if (specifier === pkg) continue;
  if (!canonicalByPackage.has(pkg)) continue;
  moduleBlocks.push(
    `declare module "${specifier}" {\n  export * from "${pkg}";\n}`,
  );
}

// 1c. Third-party (non-`@remix-run`) dependency modules referenced by the
// canonical bundles or wrappers (e.g. `@standard-schema/spec`).
for (const [specifier, bundle] of externalByModule) {
  moduleBlocks.push(
    `declare module "${specifier}" {\n${prepareModuleBody(bundle)}\n}`,
  );
}

// 2. `remix/*` re-export wrappers for the non-UI subpaths.
for (const entry of nonUiEntries) {
  const block = buildWrapperModule(entry);
  if (block) moduleBlocks.push(block);
}

// 3. UI subpaths (self-contained), excluding the standalone ones below.
const standaloneSpecifiers = new Set([
  `${remixPkg.name}/ui`,
  `${remixPkg.name}/ui/jsx-runtime`,
]);
for (const entry of uiEntries) {
  if (standaloneSpecifiers.has(entry.specifier)) continue;
  const bundle = uiBundleByFile.get(entry.filePath);
  if (bundle == null) continue;
  moduleBlocks.push(
    `declare module "${entry.specifier}" {\n${prepareModuleBody(bundle)}\n}`,
  );
}

// Standard library references the in-browser language service needs so the
// bundled types resolve globals like `Promise`, `URL`, and DOM APIs.
const libReferences = [
  '/// <reference lib="es2022" />',
  '/// <reference lib="dom" />',
  '/// <reference lib="dom.iterable" />',
];

// Ambient augmentation so `process.env.PORT` is typed in the playground.
const processEnvAugmentation = [
  "declare namespace NodeJS {",
  "  interface ProcessEnv {",
  "    PORT: string;",
  "  }",
  "}",
].join("\n");

const bundledTypes = [
  ...libReferences,
  ...[...references].sort(),
  "",
  processEnvAugmentation,
  "",
  moduleBlocks.join("\n\n"),
  "",
]
  .filter((part) => part !== undefined)
  .join("\n");

// Escape bundled `.d.ts` text so it can live inside a template literal.
function toLiteral(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${");
}

// Build a self-contained `declare module "<specifier>"` string for one of the
// standalone UI subpaths. Triple-slash references are hoisted above the module
// (they are illegal inside a `declare module` block) and the standard lib
// references are prepended so the snippet can be fed to the language service on
// its own via `addExtraLib`.
function buildStandaloneModule(subpath: string): string {
  const specifier = `${remixPkg.name}/${subpath.replace(/^\.\//, "")}`;
  const exp = remixPkg.exports[subpath];
  const types = typeof exp === "object" ? exp.types : undefined;
  if (!types) {
    console.warn(`missing export types for ${specifier}`);
    return "";
  }
  const filePath = path.resolve(remixDir, types);
  const bundle = uiBundleByFile.get(filePath);
  if (bundle == null) {
    console.warn(`missing bundle for ${specifier}`);
    return "";
  }

  const localRefs = new Set<string>();
  const body = prepareModuleBody(bundle, localRefs);

  return [
    ...libReferences,
    ...[...localRefs].sort(),
    "",
    `declare module "${specifier}" {\n${body}\n}`,
    "",
  ].join("\n");
}

const remixUiModule = buildStandaloneModule("./ui");
const remixJsxModule = buildStandaloneModule("./ui/jsx-runtime");

// ---------------------------------------------------------------------------
// Collect `@types/node` declaration files
// ---------------------------------------------------------------------------
//
// The playground's `process`/`Buffer`/`node:*` globals come from `@types/node`.
// Relying on the in-browser npm install + vfs to deliver them is unreliable, so
// embed the declaration files at build time and register them with the language
// service the same way the `remix` types are (see `monaco-editor-mixin.tsx`).
// Monaco's worker treats every registered extra lib as a program root file, so
// the ambient declarations in these files (`declare var process`, the global
// `NodeJS` namespace, `declare module "node:*"`) become available everywhere.
//
// `@types/node` ships full duplicate copies of every declaration under `tsX.Y/`
// directories (`typesVersions` fallbacks for older TypeScript). Monaco bundles a
// current TypeScript, and registering the duplicates would declare every global
// multiple times and break them, so skip those directories.
const nodeTypesDir = path.dirname(require.resolve("@types/node/package.json"));
const isTypesVersionDir = (name: string) => /^ts\d+\.\d+$/.test(name);
const nodeTypeFiles: [string, string][] = [];
(function collectNodeTypes(dir: string) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!isTypesVersionDir(entry.name)) collectNodeTypes(full);
    } else if (entry.name.endsWith(".d.ts")) {
      const rel = path.relative(nodeTypesDir, full).split(path.sep).join("/");
      nodeTypeFiles.push([rel, fs.readFileSync(full, "utf8")]);
    }
  }
})(nodeTypesDir);
nodeTypeFiles.sort(([a], [b]) => a.localeCompare(b));

const output =
  "// AUTO-GENERATED by scripts/bundle-types.ts. Do not edit by hand.\n" +
  "// Run `node --import remix/node-tsx scripts/bundle-types.ts` to regenerate.\n\n" +
  '/** Bundled `declare module "remix/*"` type definitions for the playground. */\n' +
  `export const remixTypes = \`${toLiteral(bundledTypes)}\`;\n\n` +
  '/** Self-contained `declare module "remix/ui"` definitions for the playground. */\n' +
  `export const remixUI = \`${toLiteral(remixUiModule)}\`;\n\n` +
  '/** Self-contained `declare module "remix/ui/jsx-runtime"` definitions (incl. the global JSX namespace). */\n' +
  `export const remixJSX = \`${toLiteral(remixJsxModule)}\`;\n\n` +
  "/** `@types/node` declaration files as `[relativePath, contents]` pairs, registered under\n" +
  " * `node_modules/@types/node/` so their ambient globals (`process`, `Buffer`, `node:*`) load. */\n" +
  `export const nodeTypes: ReadonlyArray<readonly [string, string]> = ${
    JSON.stringify(nodeTypeFiles)
  };\n`;

const outFile = path.join(projectRoot, "app/generated/types.ts");
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, output);

console.log(
  `\nwrote ${moduleBlocks.length} module declarations ` +
    `(${canonicalByPackage.size} @remix-run packages, ${externalByModule.size} external, ` +
    `${nonUiEntries.length} remix wrappers, ` +
    `${uiEntries.length - standaloneSpecifiers.size} ui) to ` +
    path.relative(projectRoot, outFile),
);

const failures = [
  ...sharedFailures.map((f) => ({ filePath: f.specifier, error: f.error })),
  ...externalFailures.map((f) => ({ filePath: f.specifier, error: f.error })),
  ...uiFailures,
];
if (failures.length > 0) {
  console.warn(`\n${failures.length} module(s) could not be bundled:`);
  for (const { filePath, error } of failures) {
    console.warn(`  - ${filePath}: ${error}`);
  }
}
