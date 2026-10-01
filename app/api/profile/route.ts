import { NextResponse } from "next/server";
import { profileUpdateSchema } from "@/lib/validation";
import { createServerSupabaseClient, getVerifiedIdentity } from "@/lib/supabase/server";

export async function PATCH(request: Request) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const identity = await getVerifiedIdentity(supabase);
  if (!identity) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  const parsed = profileUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the profile fields and try again." }, { status: 400 });

  const { error } = await supabase.from("profiles").update({
    full_name: parsed.data.fullName,
    updated_at: new Date().toISOString(),
  }).eq("id", identity.id);
  if (error) return NextResponse.json({ error: "The profile update was not authorised." }, { status: 403 });
  return NextResponse.json({ updated: true });
}
