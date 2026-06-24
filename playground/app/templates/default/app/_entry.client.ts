import { run } from "remix/ui";

run({
  async loadModule(moduleUrl, exportName) {
    let mod = await import(moduleUrl);
    return mod[exportName];
  },
  async resolveFrame(src, signal) {
    let response = await fetch(src, { signal });
    return response.body ?? (await response.text());
  },
});
