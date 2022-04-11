/* eslint-disable import/no-extraneous-dependencies */

import * as architect from "@remix-run/architect";

const warn = <T extends Function>(fn: T, message: string): T =>
  ((...args: unknown[]) => {
    console.warn(message);

    return fn(...args);
  }) as unknown as T;

const getDeprecatedMessage = (functionName: string, packageName: string) =>
  `All \`remix\` exports are considered deprecated as of v1.3.3. Please import \`${functionName}\` from \`@remix-run/${packageName}\` instead. You can run \`remix migrate --migration replace-remix-imports\` to automatically migrate your code.`;

// Re-export everything from this package that is available in `remix`.

/** @deprecated Import `createArcTableSessionStorage` from `@remix-run/architect` instead. */
export const createArcTableSessionStorage = warn(
  architect.createArcTableSessionStorage,
  getDeprecatedMessage("createArcTableSessionStorage", "architect")
);
