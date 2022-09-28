type Mode = "development" | "test" | "production";

type Target =
  | "browser" // TODO: remove
  | "server" // TODO: remove
  | "cloudflare-workers"
  | "node14";

export type Options = {
  mode: Mode;
  sourcemap: boolean;
  target: Target;
  onWarning?: (message: string, key: string) => void;
  // onBuildFailure?(failure: Error | esbuild.BuildFailure): void;
};
