export const TRAINING_RESUME_STAGES = ["overview", "learning", "activity", "quiz", "completed"] as const;

export type TrainingResumeStage = (typeof TRAINING_RESUME_STAGES)[number];

export interface TrainingResumeState {
  stage: TrainingResumeStage;
  position: number;
}

function boundedPosition(position: number) {
  return Math.max(0, Math.min(100, Math.round(position)));
}

export function getTrainingResumeHref(slug: string, state: TrainingResumeState) {
  const position = boundedPosition(state.position);

  if (state.stage === "activity") {
    return slug === "hazard-perception"
      ? "/training/hazard-perception/scene"
      : `/training/${slug}/activity`;
  }

  if (state.stage === "quiz") return `/training/${slug}/quiz`;
  if (state.stage === "learning" && position > 0) {
    return `/training/${slug}#learning-${Math.max(1, position)}`;
  }

  return `/training/${slug}`;
}

export function getTrainingResumeLabel(stage: TrainingResumeStage, progressPercent: number) {
  if (stage === "completed") return "Review module";
  if (stage === "quiz") return "Resume knowledge check";
  if (stage === "activity") return "Resume activity";
  return progressPercent > 0 ? "Continue learning" : "View module";
}

export function learningSectionPosition(index: number, sectionCount: number) {
  if (sectionCount <= 0) return 0;
  return boundedPosition(((index + 1) / sectionCount) * 100);
}
