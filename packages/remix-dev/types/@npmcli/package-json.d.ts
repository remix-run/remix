// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type Content = import("type-fest").PackageJson;

function load(path: string): NpmCliPackageJson;

interface NpmCliPackageJson {
  content: Content;
  update: (content: Content) => void;
  save: () => Promise<void>;
}

declare module "@npmcli/package-json" {
  export type PackageJson = Content;
  export default { load };
}
