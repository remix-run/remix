Use polling for asset server file watching by default on Windows to avoid native filesystem watcher crashes while still allowing explicit `watch.poll` overrides.
