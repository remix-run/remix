import "@remix-run/deno/globals.ts";

// Deno will exist in Deno land and we only need the minimal types for ProcessEnv
// The types for this for Deno are defined in globals.d.ts in the Netlify template
// @ts-ignore
globalThis.process ||= { env: Deno.env.toObject() };
