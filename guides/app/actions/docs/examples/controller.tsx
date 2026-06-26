import { fileURLToPath } from "node:url";

import { createController } from "remix/router";

import type { AppContext } from "../../../router.ts";
import { routes } from "../../../routes.ts";

const exampleSegmentPattern = /^[a-z0-9][a-z0-9-]*$/;

export default createController(routes.docs.examples, {
  actions: {
    show: async (context) => {
      let { chapter, example } = context.params;

      if (
        !exampleSegmentPattern.test(chapter) ||
        !exampleSegmentPattern.test(example)
      ) {
        return new Response("Not Found", { status: 404 });
      }

      let handler = await loadExampleHandler(chapter, example);
      if (!handler) {
        return new Response("Not Found", { status: 404 });
      }

      return handler(context);
    },
  },
});

async function loadExampleHandler(chapter: string, example: string) {
  let moduleUrl = new URL(`./${chapter}/${example}.tsx`, import.meta.url);

  let mod: unknown;
  try {
    mod = await import(moduleUrl.href);
  } catch (error) {
    if (isModuleNotFoundError(error)) {
      return undefined;
    }

    throw error;
  }

  return readExampleHandler(mod, moduleUrl);
}

function readExampleHandler(mod: unknown, moduleUrl: URL) {
  if (
    !mod ||
    typeof mod !== "object" ||
    !("handler" in mod) ||
    typeof mod.handler !== "function"
  ) {
    return undefined;
  }

  let handler = mod.handler;

  return async (context: AppContext) => {
    let result = await handler(context);
    if (result instanceof Response) {
      return result;
    }

    throw new Error(
      `Expected example handler to return a Response: ${fileURLToPath(moduleUrl)}`,
    );
  };
}

function isModuleNotFoundError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    error.code === "ERR_MODULE_NOT_FOUND"
  );
}
