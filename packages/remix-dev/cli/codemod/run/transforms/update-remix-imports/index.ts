import { join } from "path";

import { JSCodeshiftTransform } from "../jscodeshift-transform";
import type { Transform } from "../types";

const transformPath = join(__dirname, "jscodeshift-transform");

export const updateRemixImports: Transform = async ({ files, flags }) => {
  return JSCodeshiftTransform({ files, flags, transformPath });
};

// escape-hatch to include these files in the build
export * as JSCodeshiftTransform from "./jscodeshift-transform";
