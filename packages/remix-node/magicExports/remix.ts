/* eslint-disable import/no-extraneous-dependencies */

import * as node from "@remix-run/node";
import type * as NodeTypes from "@remix-run/node";

const warn = <T extends Function>(fn: T, message: string): T =>
  ((...args: unknown[]) => {
    console.warn(message);

    return fn(...args);
  }) as unknown as T;

const getDeprecatedMessage = (functionName: string, packageName: string) =>
  `All \`remix\` exports are considered deprecated as of v1.3.3. Please import \`${functionName}\` from \`@remix-run/${packageName}\` instead. You can run \`remix migrate --migration replace-remix-imports\` to automatically migrate your code.`;

// Re-export everything from this package that is available in `remix`.

/** @deprecated Import `createCookie` from `@remix-run/node` instead. */
export const createCookie = warn(
  node.createCookie,
  getDeprecatedMessage("createCookie", "node")
);
/** @deprecated Import `createSessionStorage` from `@remix-run/node` instead. */
export const createSessionStorage = warn(
  node.createSessionStorage,
  getDeprecatedMessage("createSessionStorage", "node")
);
/** @deprecated Import `createCookieSessionStorage` from `@remix-run/node` instead. */
export const createCookieSessionStorage = warn(
  node.createCookieSessionStorage,
  getDeprecatedMessage("createCookieSessionStorage", "node")
);
/** @deprecated Import `createMemorySessionStorage` from `@remix-run/node` instead. */
export const createMemorySessionStorage = warn(
  node.createMemorySessionStorage,
  getDeprecatedMessage("createMemorySessionStorage", "node")
);
/** @deprecated Import `createFileSessionStorage` from `@remix-run/node` instead. */
export const createFileSessionStorage = warn(
  node.createFileSessionStorage,
  getDeprecatedMessage("createFileSessionStorage", "node")
);
/** @deprecated Import `unstable_createFileUploadHandler` from `@remix-run/node` instead. */
export const unstable_createFileUploadHandler = warn(
  node.unstable_createFileUploadHandler,
  getDeprecatedMessage("unstable_createFileUploadHandler", "node")
);
/** @deprecated Import `unstable_createMemoryUploadHandler` from `@remix-run/node` instead. */
export const unstable_createMemoryUploadHandler = warn(
  node.unstable_createMemoryUploadHandler,
  getDeprecatedMessage("unstable_createMemoryUploadHandler", "node")
);
/** @deprecated Import `unstable_parseMultipartFormData` from `@remix-run/node` instead. */
export const unstable_parseMultipartFormData = warn(
  node.unstable_parseMultipartFormData,
  getDeprecatedMessage("unstable_parseMultipartFormData", "node")
);

/** @deprecated Import type `UploadHandler` from `@remix-run/node` instead. */
export type UploadHandler = NodeTypes.UploadHandler;
/** @deprecated Import type `UploadHandlerArgs` from `@remix-run/node` instead. */
export type UploadHandlerArgs = NodeTypes.UploadHandlerArgs;
