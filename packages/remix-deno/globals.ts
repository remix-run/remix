/*
Remix provides `process.env.NODE_ENV` at compile time.
Declare types for `process` here so that they are available in Deno.
*/

interface ProcessEnv {
  NODE_ENV: "development" | "production" | "test";
}
interface Process {
  env: ProcessEnv;
}
// deno-lint-ignore no-unused-vars no-var
var process: Process;
