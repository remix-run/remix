Generate cross-platform npm scripts in new projects so they run on Windows

The scaffolded `package.json` previously set `NODE_ENV` with a POSIX-only `NODE_ENV=value ...` prefix. npm runs scripts through `cmd.exe` on Windows, which treats that prefix as a command and fails with `'NODE_ENV' is not recognized`. The `dev`, `hmr`, and `test` scripts now rely on the development/test defaults already built into the asset pipeline and `remix test`, and a new `start.ts` entry sets `NODE_ENV=production` before importing the server so the `start` script stays portable.
