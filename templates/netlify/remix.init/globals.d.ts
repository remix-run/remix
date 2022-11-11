export {};

declare global {
  interface ProcessEnv {
    [key: string]: string | undefined;
    NODE_ENV?: "development" | "production" | "test";
  }
  interface Process {
    env: ProcessEnv;
  }

  // deno-lint-ignore no-var
  var process: Process;
}
