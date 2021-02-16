import type { Plugin } from "rollup";

import { BuildTarget } from "../build";

const emptyId = "\0clientServerEmpty";

/**
 * Rollup plugin that uses an empty shim for modules imported using
 * `client:...` and/or `server:...` depending on the build target. `client:...`
 * modules are empty in the server build, and `server:...` modules are empty in
 * the browser build.
 */
export default function clientServerPlugin({
  target
}: {
  target: string;
}): Plugin {
  console.log(`create client plugin for ${target}`);

  return {
    name: "client",

    resolveId(id, importer) {
      if (id === emptyId) return id;

      if (
        id[0] === "\0" ||
        !(id.startsWith("client:") || id.startsWith("server:"))
      ) {
        return;
      }

      let hint = id.slice(0, 7);

      if (
        (hint === "client:" && target === BuildTarget.Server) ||
        (hint === "server:" && target === BuildTarget.Browser)
      ) {
        return emptyId;
      }

      return this.resolve(id.slice(hint.length), importer, {
        skipSelf: true
      });
    },

    load(id) {
      if (id !== emptyId) {
        return;
      }

      return {
        code: "export default {}",
        syntheticNamedExports: true
      };
    }
  };
}
