import { GAME_NAMES, type GameId } from "@/lib/learning-games";

export interface AdminActivityEvent {
  id: string;
  category: string;
  eventType: string;
  subject: string;
  moduleTitle: string | null;
  detail: string;
  createdAt: string;
}

export function activityDetail(eventType: string, metadata: Record<string, unknown>) {
  const percentage = typeof metadata.percentage === "number" ? Math.round(metadata.percentage) : null;
  const score = typeof metadata.score === "number" ? Math.round(metadata.score) : null;
  if (eventType === "game_completed" && score !== null) return `Game score: ${score}%`;
  if (eventType === "quiz_completed" && percentage !== null) return `${percentage}% · ${metadata.passed === true ? "Passed" : "Review required"}`;
  const progress = typeof metadata.progressPercent === "number" ? Math.round(metadata.progressPercent) : percentage;
  if (eventType === "progress_updated" && progress !== null) return `${progress}% of module completed`;
  if (eventType === "game_progress_saved") return "Game moves saved · trainee can resume";
  if (eventType === "game_started") return "Interactive challenge started";
  if (eventType === "activity_completed") return metadata.correct === true ? "Safer decision recorded" : metadata.correct === false ? "Decision recorded · feedback provided" : "Hazard identified";
  return "Saved by the training system";
}

export function normaliseAdminEvent(row: Record<string, unknown>): AdminActivityEvent {
  const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? row.metadata as Record<string, unknown> : {};
  const eventType = String(row.event_type ?? "activity");
  const category = typeof row.category === "string" && row.category
    ? row.category
    : eventType.startsWith("game_") || (eventType === "activity_completed" && ["forklift_precheck", "ppe_dress_up", "sorting_zone", "load_stacking"].includes(String(metadata.activityKind))) ? "games" : "training";
  return { id: String(row.id), category, eventType,
    subject: typeof row.subject_name === "string" && row.subject_name ? row.subject_name : "System",
    moduleTitle: typeof row.module_title === "string" ? row.module_title : typeof metadata.gameName === "string" ? metadata.gameName : GAME_NAMES[metadata.gameId as GameId] ?? null,
    detail: activityDetail(eventType, metadata), createdAt: String(row.created_at) };
}
