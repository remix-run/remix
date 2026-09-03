Fixed serving packages that a package manager installs outside `rootDir`, such as pnpm's global virtual store, which previously failed the first request with `IMPORT_OUTSIDE_MOUNTS`

The asset server now reads the store location from the nearest `node_modules/.modules.yaml` and mounts it internally under `/__@remix/virtual-store`. A store that a configured mount already covers, such as pnpm's default `node_modules/.pnpm`, is left alone.
