import { NextResponse } from "next/server";
import {
  getRoleMismatchFeedback,
  type LoginAudience,
} from "@/lib/auth-feedback";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const selectedAudience: LoginAudience = requestUrl.searchParams.get("audience") === "admin"
    ? "admin"
    : "trainee";
  const supabase = await createServerSupabaseClient();

  if (supabase) {
    await supabase.auth.signOut({ scope: "local" });
  }

  const loginUrl = new URL("/login", requestUrl.origin);
  loginUrl.searchParams.set("error", getRoleMismatchFeedback(selectedAudience));
  return NextResponse.redirect(loginUrl);
}
