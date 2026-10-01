import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { hasActiveRole } from "@/lib/roles";
import { activityCompletionSchema, moduleSlugSchema } from "@/lib/validation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getTrainingModule } from "@/lib/training-data";

export async function GET(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  if (!hasActiveRole(viewer, "trainee")) return NextResponse.json({ error: "Active trainee access is required." }, { status: 403 });
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });

  const moduleSlug = new URL(request.url).searchParams.get("moduleSlug");
  if (!moduleSlugSchema.safeParse(moduleSlug).success) {
    return NextResponse.json({ error: "The training module was not valid." }, { status: 400 });
  }

  const { data: module } = await supabase
    .from("training_modules")
    .select("id")
    .eq("slug", moduleSlug as string)
    .eq("status", "published")
    .eq("is_published", true)
    .maybeSingle();
  if (!module) return NextResponse.json({ error: "The training module was not found." }, { status: 404 });

  const { data, error } = await supabase.rpc("decision_activity_progress", { module_id: module.id });
  if (error) return NextResponse.json({ error: "Activity progress could not be loaded." }, { status: 400 });
  const staticModule = getTrainingModule(moduleSlug as string);
  const events = Array.isArray(data) ? data as Array<Record<string, unknown>> : [];

  return NextResponse.json({
    events: events.map((event) => {
      const eventKey = typeof event.scenarioId === "string" ? event.scenarioId : "";
      const selectedChoiceId = typeof event.selectedChoiceId === "string" ? event.selectedChoiceId : "";
      const staticFeedback = staticModule?.activities
        .find((scenario) => scenario.id === eventKey)?.choices
        .find((choice) => choice.id === selectedChoiceId)?.feedback;
      return {
        eventKey,
        selectedChoiceId,
        correct: event.correct === true,
        feedback: typeof event.feedback === "string" && event.feedback ? event.feedback : staticFeedback,
      };
    }),
  });
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  if (!hasActiveRole(viewer, "trainee")) return NextResponse.json({ error: "Active trainee access is required." }, { status: 403 });
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });

  const parsed = activityCompletionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "The activity result was not valid." }, { status: 400 });

  const { data: module } = await supabase
    .from("training_modules")
    .select("id, slug")
    .eq("id", parsed.data.moduleId)
    .eq("slug", parsed.data.moduleSlug)
    .eq("status", "published")
    .eq("is_published", true)
    .maybeSingle();
  if (!module) return NextResponse.json({ error: "The published training module was not found." }, { status: 404 });

  if (parsed.data.moduleSlug !== "hazard-perception") {
    const { data, error } = await supabase.rpc("record_decision_activity", {
      module_id: parsed.data.moduleId,
      scenario_id: parsed.data.scenarioId,
      selected_choice_id: parsed.data.selectedChoiceId,
    });
    if (error) return NextResponse.json({ error: error.message || "Activity progress could not be recorded." }, { status: 400 });
    const result = data && typeof data === "object" ? data as Record<string, unknown> : {};
    const staticFeedback = getTrainingModule(parsed.data.moduleSlug)?.activities
      .find((scenario) => scenario.id === parsed.data.scenarioId)?.choices
      .find((choice) => choice.id === result.selectedChoiceId)?.feedback;
    return NextResponse.json({
      saved: true,
      correct: result.correct === true,
      feedback: typeof result.feedback === "string" && result.feedback ? result.feedback : staticFeedback,
      selectedChoiceId: result.selectedChoiceId,
      progress: data,
    });
  }

  const common = {
    module_id: parsed.data.moduleId,
    progress_percent: null,
    metadata: { source: "safety360-web" },
  };

  const [learningResult, activityResult] = await Promise.all([
    supabase.rpc("record_training_activity", {
      ...common,
      event_type: "learning_completed",
      event_key: `${parsed.data.moduleSlug}:learning`,
    }),
    supabase.rpc("record_training_activity", {
      ...common,
      event_type: "activity_completed",
      event_key: parsed.data.hazardId,
      metadata: { source: "safety360-web" },
    }),
  ]);
  if (learningResult.error) return NextResponse.json({ error: "Learning progress could not be recorded." }, { status: 400 });
  if (activityResult.error) return NextResponse.json({ error: "Activity progress could not be recorded." }, { status: 400 });

  return NextResponse.json({ saved: true, progress: activityResult.data });
}
