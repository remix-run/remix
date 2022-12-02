import "@remix-run/deno/globals.ts";

// @ts-ignore
globalThis.process ||= { env: Deno.env.toObject() };
