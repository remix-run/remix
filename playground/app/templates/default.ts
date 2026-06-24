export type TemplateFile = {
  readonly: boolean;
  contents: string;
  implementation?: string;
};

// Template files live in `templates/default/` and follow a path-based convention:
//   - normal files use their plain path (e.g. `default/package.json`)
//   - readonly files are prefixed with `_` (e.g. `default/_tsconfig.json`)
//   - implementations are prefixed with `__` (e.g. `default/__server.ts`),
//     paired with a readonly `_`-prefixed file of the same name.
const rawFiles = import.meta.glob("./default/**/*", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function splitPath(relativePath: string): { dir: string; name: string } {
  const segments = relativePath.split("/");
  const name = segments.pop() ?? "";
  return { dir: segments.join("/"), name };
}

function joinPath(dir: string, name: string): string {
  return dir ? `${dir}/${name}` : name;
}

function buildTemplateFiles(raw: Record<string, string>): Record<string, TemplateFile> {
  const files: Record<string, TemplateFile> = {};
  const implementations: Record<string, string> = {};

  for (const [globPath, contents] of Object.entries(raw)) {
    const relativePath = globPath.replace(/^\.\/default\//, "");
    const { dir, name } = splitPath(relativePath);

    if (name.startsWith("__")) {
      // Implementation for a readonly file.
      implementations[joinPath(dir, name.slice(2))] = contents;
      continue;
    }

    const readonly = name.startsWith("_");
    const realName = readonly ? name.slice(1) : name;
    files[joinPath(dir, realName)] = { readonly, contents };
  }

  for (const [path, implementation] of Object.entries(implementations)) {
    const file = files[path];
    if (file) {
      file.implementation = implementation;
    }
  }

  return files;
}

export const templateFiles: Record<string, TemplateFile> = buildTemplateFiles(rawFiles);
