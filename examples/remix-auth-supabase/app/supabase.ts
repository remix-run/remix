import { createClient } from "@supabase/supabase-js";
import type { Session } from "@supabase/supabase-js";

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      SUPABASE_URL: string;
      SUPABASE_SERVICE_KEY: string;
    }
  }
}

if (!process.env.SUPABASE_URL) {
  throw new Error("SUPABASE_URL is required");
}

if (!process.env.SUPABASE_SERVICE_KEY) {
  throw new Error("SUPABASE_SERVICE_KEY is required");
}

// Supabase options example, build your own :)
// https://supabase.com/docs/reference/javascript/initializing#with-additional-parameters

// ⚠️ cloudflare needs you define fetch option : https://github.com/supabase/supabase-js#custom-fetch-implementation
// Remix polyfills fetch, no need to do fetch: (...args) => fetch(...args)
// Check https://remix.run/docs/en/v1/other-api/node

// const supabaseOptions = {
//   fetch,
//   schema: "public",
//   persistSession: true,
//   autoRefreshToken: true,
//   detectSessionInUrl: true,
//   headers: { "x-application-name": "{my-site-name}" }
// };

export const supabaseClient = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
  // supabaseOptions
);

export { Session };
