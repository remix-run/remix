// https://stackoverflow.com/a/59499895
export {};

declare global {
  interface ProcessEnv {
    NODE_ENV: "development" | "production" | "test";
  }

  interface WorkerGlobalScope {
    process: { env: ProcessEnv };
  }
}
