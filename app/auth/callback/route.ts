import { NextResponse } from "next/server";
import { getSafeAuthDestination, parseEmailOtpType } from "@/lib/auth-callback";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const otpType = parseEmailOtpType(url.searchParams.get("type"));
  const fallback = otpType === "recovery" ? "/reset-password" : "/dashboard";
  const safeNext = getSafeAuthDestination(url.origin, url.searchParams.get("next"), fallback);
  const supabase = await createServerSupabaseClient();

  if (supabase) {
    const result = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : tokenHash && otpType
        ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType })
        : null;

    if (result && !result.error) {
      return NextResponse.redirect(new URL(safeNext, url.origin));
    }
  }

  const failure = new URL("/login", url.origin);
  failure.searchParams.set("error", "This confirmation link is invalid or has expired. Request a new email and try again.");
  return NextResponse.redirect(failure);
}
