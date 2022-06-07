/*
Remix provides `process.env.NODE_ENV` at compile time.
Declare types for `process` here so that they are available in Deno.
*/

interface ProcessEnv {
  NODE_ENV: "development" | "production" | "test";
  REMIX_DEV_SERVER_WS_PORT: string;
}
interface Process {
  env: ProcessEnv;
}
var process: Process;
