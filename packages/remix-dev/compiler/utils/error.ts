import type esbuild from "esbuild";

export let toError = (thrown: unknown): Error => {
  if (thrown instanceof Error) return thrown;
  try {
    return new Error(JSON.stringify(thrown));
  } catch {
    // fallback in case there's an error stringifying.
    // for example, due to circular references.
    return new Error(String(thrown));
  }
};

export let isEsbuildError = (error: Error): error is esbuild.BuildFailure => {
  return "warnings" in error && "errors" in error;
};
