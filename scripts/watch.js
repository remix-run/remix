import { spawn } from "child_process";

spawn("tsc", ["--watch"], {
  env: process.env,
  stdio: "inherit"
});
