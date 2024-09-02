const { spawnSync } = require("node:child_process");
const path = require("node:path");

const denoProjectPaths = process.argv
  .slice(2)
  .map((denoProjectDir) => path.join(process.cwd(), denoProjectDir));

for (let denoProjectPath of denoProjectPaths) {
  let { error } = spawnSync(
    "deno",
    ["install", "--allow-scripts", "--no-lock"],
    {
      cwd: denoProjectPath,
      env: { ...process.env, DENO_FUTURE: "1" },
      stdio: "inherit",
    }
  );

  if (error) {
    console.warn(
      new Error(
        `Failed to install dependencies for Deno project at ${denoProjectPath}`,
        { cause: error }
      )
    );
  }
}
