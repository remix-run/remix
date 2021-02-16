import type { Plugin } from "rollup";

const emptyId = "\0empty";

/**
 * Rollup plugin that uses an empty shim for any module id that is considered
 * "empty" according to the given `isEmptyModuleId` test function.
 */
export default function emptyPlugin({
  name = "empty",
  isEmptyModuleId
}: {
  name?: string;
  isEmptyModuleId: (id: string) => boolean;
}): Plugin {
  return {
    name,

    resolveId(id) {
      if (id[0] === "\0") return;

      if (id === emptyId) return id;

      if (isEmptyModuleId(id)) {
        return emptyId;
      }

      return undefined;
    },

    load(id) {
      if (id !== emptyId) return;

      return {
        code: "export default {}",
        syntheticNamedExports: true
      };
    }
  };
}
