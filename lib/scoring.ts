export const PASS_THRESHOLD = 70;

export function percentage(score: number, maximum: number) {
  if (!Number.isFinite(score) || !Number.isFinite(maximum) || maximum <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((score / maximum) * 100)));
}

export function hasPassed(score: number, maximum: number) {
  return percentage(score, maximum) >= PASS_THRESHOLD;
}

export function overallProgress(completed: number, assignedOrPublished: number) {
  return percentage(completed, assignedOrPublished);
}

export function uniqueHazardPoints(hazardIds: string[]) {
  return new Set(hazardIds).size * 100;
}

export function isModuleComplete(input: {
  learningComplete: boolean;
  activityComplete: boolean;
  bestQuizPercentage: number | null;
}) {
  return input.learningComplete && input.activityComplete && (input.bestQuizPercentage ?? 0) >= PASS_THRESHOLD;
}
