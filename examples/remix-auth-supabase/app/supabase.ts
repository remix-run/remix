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

export const supabaseClient = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export { Session };
