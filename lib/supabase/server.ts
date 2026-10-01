import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "./config";

export interface VerifiedIdentity {
  id: string;
  email: string;
}

export async function createServerSupabaseClient() {
  if (!isSupabaseConfigured) return null;

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot always write cookies. A subsequent route
          // request refreshes the session through the same SSR client.
        }
      },
    },
  });
}

/**
 * Verify the signed access token without an Auth-server round trip when the
 * project uses asymmetric signing keys. getClaims() still refreshes an
 * expiring session and falls back to the Auth server when local verification
 * is unavailable, so this remains a trusted identity check.
 */
export async function getVerifiedIdentity(
  supabase: SupabaseClient,
): Promise<VerifiedIdentity | null> {
  const { data, error } = await supabase.auth.getClaims();
  const id = data?.claims.sub;
  if (error || typeof id !== "string" || !id) return null;

  return {
    id,
    email: typeof data.claims.email === "string" ? data.claims.email : "",
  };
}
