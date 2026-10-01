import { NextResponse } from "next/server";
import { z } from "zod";
import { getViewer } from "@/lib/auth";
import { hasActiveRole } from "@/lib/roles";
import { quizAnswerSchema } from "@/lib/validation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  if (!hasActiveRole(viewer, "trainee")) return NextResponse.json({ error: "Active trainee access is required." }, { status: 403 });
  const moduleId = z.string().uuid().safeParse(new URL(request.url).searchParams.get("moduleId"));
  if (!moduleId.success) return NextResponse.json({ error: "The training module was not valid." }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data, error } = await supabase.rpc("quiz_resume_state", { module_id: moduleId.data });
  if (error) return NextResponse.json({ error: "Saved assessment progress could not be loaded." }, { status: 400 });
  return NextResponse.json({ answers: Array.isArray(data) ? data : [] });
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  if (!hasActiveRole(viewer, "trainee")) return NextResponse.json({ error: "Active trainee access is required." }, { status: 403 });
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });

  const parsed = quizAnswerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "The selected answer was not valid." }, { status: 400 });

  const { data, error } = await supabase.rpc("check_quiz_answer", {
    question_id: parsed.data.questionId,
    selected_answer: parsed.data.selectedAnswer,
  });
  if (error) return NextResponse.json({ error: "The answer could not be checked securely." }, { status: 400 });

  return NextResponse.json(data);
}
