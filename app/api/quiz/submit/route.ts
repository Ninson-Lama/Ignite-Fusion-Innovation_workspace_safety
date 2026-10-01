import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { hasActiveRole } from "@/lib/roles";
import { quizSubmissionSchema } from "@/lib/validation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  if (!hasActiveRole(viewer, "trainee")) return NextResponse.json({ error: "Active trainee access is required." }, { status: 403 });
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });

  const parsed = quizSubmissionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "The assessment submission was not valid." }, { status: 400 });

  const { data, error } = await supabase.rpc("submit_quiz", {
    module_id: parsed.data.moduleId,
    submitted_answers: parsed.data.answers,
  });
  if (error) return NextResponse.json({ error: "The assessment could not be scored securely." }, { status: 400 });

  const result = data as { attempt_id?: string; attemptId?: string; percentage?: number; passed?: boolean } | null;
  return NextResponse.json({
    attemptId: result?.attempt_id ?? result?.attemptId,
    percentage: result?.percentage ?? 0,
    passed: result?.passed ?? false,
  });
}
