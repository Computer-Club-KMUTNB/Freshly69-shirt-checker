import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** Server-only Supabase client (service role). Never import this from a client component. */
export function db(): SupabaseClient {
  if (client) return client;
  // Accept the common copy-paste mistake "https://xxx.supabase.co/rest/v1/" — the client needs the bare origin.
  const url = process.env.SUPABASE_URL?.trim().replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (see .env.example)");
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
