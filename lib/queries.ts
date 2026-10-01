import { overallProgress } from "@/lib/scoring";
import { buildCertificateReference } from "@/lib/certificates";
import { getAuthoringReadiness, moduleAuthoringDefinitionSchema, parseAuthoredPublicContent } from "@/lib/module-authoring";
import type { AuthoringReadiness, AuthoredPublicContent, ModuleAuthoringDefinition } from "@/lib/module-authoring";
import { resolveModuleCoverUrl } from "@/lib/module-covers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getTrainingResumeHref, getTrainingResumeLabel, TRAINING_RESUME_STAGES, type TrainingResumeStage } from "@/lib/training-resume";
import type { DashboardSummary, LeaderboardEntry, QuizQuestion, TrainingCertificateRecord } from "@/types";

export interface TrainingLibraryItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  estimatedMinutes: number;
  difficulty: string;
  isPublished: boolean;
  isAssigned: boolean;
  progressPercent: number;
  status: string;
  pointsEarned: number;
  dueDate: string | null;
  heroImageUrl: string;
  resumeStage: TrainingResumeStage;
  resumePosition: number;
  resumeHref: string;
  resumeLabel: string;
}

export interface AssignmentNotification {
  id: string;
  moduleId: string;
  moduleSlug: string;
  moduleTitle: string;
  dueDate: string | null;
  sentAt: string;
  readAt: string | null;
}

export interface PublishedModuleMetadata {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  estimatedMinutes: number;
  difficulty: string;
  passMark: number;
  overview: string;
  learningObjectives: string[];
  content: AuthoredPublicContent | null;
  heroImageUrl: string;
}

export interface AdminModuleDraft {
  moduleId: string;
  status: string;
  isPublished: boolean;
  editable: boolean;
  definition: ModuleAuthoringDefinition;
  readiness: AuthoringReadiness;
  coverPreviewUrl: string | null;
  canDelete: boolean;
  updatedAt: string | null;
}

export interface AdminModuleOverview {
  id: string;
  title: string;
  description: string;
  slug: string;
  estimated_minutes: number;
  difficulty: string;
  status: string;
  is_published: boolean;
  sort_order: number;
  is_authored: boolean;
  can_delete: boolean;
  updated_at: string | null;
  readiness: { ready: boolean; issues: string[] };
}

export interface RecentAttempt {
  id: string;
  moduleTitle: string;
  moduleSlug: string;
  percentage: number;
  passed: boolean;
  completedAt: string;
}

export interface RecentActivity {
  id: string;
  eventType: string;
  createdAt: string;
  moduleTitle: string | null;
}

export interface DashboardData {
  summary: DashboardSummary;
  modules: TrainingLibraryItem[];
  latestAttempt: RecentAttempt | null;
  recentActivity: RecentActivity[];
  achievements: Array<{ id: string; title: string; description: string; earnedAt: string }>;
}

interface LeaderboardRpcRow {
  rank: number | string;
  user_id: string;
  display_name: string;
  points: number | string;
  completed_modules: number | string;
  achievement: string | null;
}

interface PublicQuestionRpcRow {
  id: string;
  prompt: string;
  question_type: QuizQuestion["questionType"];
  options: unknown;
  sort_order: number;
}

export interface ReportsSummary {
  scope: "organisation" | "department";
  department: string | null;
  totalTrainees: number;
  totalAssignments: number;
  completedAssignments: number;
  overdueAssignments: number;
  completionRate: number;
  averageQuizPercentage: number | null;
  usersRequiringReview: number;
  generatedAt: string;
}

interface AttemptResultRpc {
  id: string;
  user_id: string;
  module_id: string;
  attempt_number: number;
  score: number;
  max_score: number;
  percentage: number;
  passed: boolean;
  activity_score: number;
  points_earned: number;
  started_at: string;
  completed_at: string;
  module_slug: string;
  module_title: string;
}

const emptySummary: DashboardSummary = {
  overallProgress: 0,
  completedModules: 0,
  assignedModules: 0,
  safetyPoints: 0,
  latestScore: null,
  rank: null,
};

function moduleJoin(value: unknown): { id?: string; slug?: string; title?: string; category?: string } {
  if (!value || typeof value !== "object") return {};
  if (Array.isArray(value)) return moduleJoin(value[0]);
  return value as { id?: string; slug?: string; title?: string; category?: string };
}

function achievementJoin(value: unknown): { title?: string; description?: string } {
  if (!value || typeof value !== "object") return {};
  if (Array.isArray(value)) return achievementJoin(value[0]);
  return value as { title?: string; description?: string };
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function resumeStage(value: unknown): TrainingResumeStage {
  return typeof value === "string" && TRAINING_RESUME_STAGES.includes(value as TrainingResumeStage)
    ? value as TrainingResumeStage
    : "overview";
}

export async function getTrainingLibrary(userId: string): Promise<TrainingLibraryItem[]> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return [];

  const [{ data: modules }, { data: progress }, { data: assignments }] = await Promise.all([
    supabase
      .from("training_modules")
      .select("id, slug, title, description, category, estimated_minutes, difficulty, is_published, sort_order, hero_image_path")
      .eq("is_published", true)
      .order("sort_order"),
    supabase
      .from("module_progress")
      .select("module_id, progress_percent, status, points_earned, resume_stage, resume_position")
      .eq("user_id", userId),
    supabase
      .from("module_assignments")
      .select("module_id, due_date, status")
      .eq("user_id", userId),
  ]);

  const progressByModule = new Map((progress ?? []).map((row) => [row.module_id, row]));
  const assignmentByModule = new Map(
    (assignments ?? [])
      .filter((row) => row.status !== "cancelled")
      .map((row) => [row.module_id, row]),
  );

  const items = await Promise.all((modules ?? []).map(async (module) => {
    const progressRecord = progressByModule.get(module.id);
    const stage = resumeStage(progressRecord?.resume_stage);
    const position = Number(progressRecord?.resume_position ?? 0);
    const progressPercent = progressRecord?.progress_percent ?? 0;
    return {
      id: module.id,
      slug: module.slug,
      title: module.title,
      description: module.description,
      category: module.category,
      estimatedMinutes: module.estimated_minutes,
      difficulty: module.difficulty,
      isPublished: module.is_published,
      isAssigned: assignmentByModule.has(module.id),
      progressPercent,
      status: progressRecord?.status ?? "not_started",
      pointsEarned: progressRecord?.points_earned ?? 0,
      dueDate: assignmentByModule.get(module.id)?.due_date ?? null,
      heroImageUrl: await resolveModuleCoverUrl(supabase, module.hero_image_path),
      resumeStage: stage,
      resumePosition: position,
      resumeHref: getTrainingResumeHref(module.slug, { stage, position }),
      resumeLabel: getTrainingResumeLabel(stage, progressPercent),
    };
  }));
  return items.sort((a, b) => Number(b.isAssigned) - Number(a.isAssigned));
}

export async function getAssignmentNotifications(userId: string): Promise<AssignmentNotification[]> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("module_assignments")
    .select("id, module_id, due_date, notification_sent_at, notification_read_at, training_modules(slug, title)")
    .eq("user_id", userId)
    .neq("status", "cancelled")
    .order("notification_sent_at", { ascending: false })
    .limit(8);

  if (error) return [];
  return (data ?? []).map((assignment) => {
    const trainingModule = moduleJoin(assignment.training_modules);
    return {
      id: assignment.id,
      moduleId: assignment.module_id,
      moduleSlug: trainingModule.slug ?? "training",
      moduleTitle: trainingModule.title ?? "Training module",
      dueDate: assignment.due_date,
      sentAt: assignment.notification_sent_at,
      readAt: assignment.notification_read_at,
    };
  });
}

export async function getTrainingCertificates(userId: string): Promise<TrainingCertificateRecord[]> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return [];

  const [{ data: completedProgress }, { data: passedAttempts }] = await Promise.all([
    supabase
      .from("module_progress")
      .select("module_id, completed_at, training_modules(id, slug, title, category)")
      .eq("user_id", userId)
      .eq("status", "completed")
      .eq("progress_percent", 100)
      .eq("learning_complete", true)
      .eq("activity_complete", true)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false }),
    supabase
      .from("quiz_attempts")
      .select("id, module_id, completed_at")
      .eq("user_id", userId)
      .eq("passed", true)
      .order("completed_at", { ascending: true }),
  ]);

  const firstPassingAttemptByModule = new Map<string, { id: string; completed_at: string }>();
  for (const attempt of passedAttempts ?? []) {
    if (!firstPassingAttemptByModule.has(attempt.module_id)) {
      firstPassingAttemptByModule.set(attempt.module_id, attempt);
    }
  }

  return (completedProgress ?? []).flatMap((progress) => {
    const moduleInfo = moduleJoin(progress.training_modules);
    const attempt = firstPassingAttemptByModule.get(progress.module_id);
    if (!progress.completed_at || !attempt || !moduleInfo.slug || !moduleInfo.title) return [];

    return [{
      moduleId: progress.module_id,
      moduleSlug: moduleInfo.slug,
      moduleTitle: moduleInfo.title,
      category: moduleInfo.category ?? "Safety training",
      completedAt: progress.completed_at,
      attemptId: attempt.id,
      certificateReference: buildCertificateReference(attempt.id, progress.completed_at),
    }];
  });
}

export async function getPublishedModuleMetadata(slug: string): Promise<PublishedModuleMetadata | null> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("training_modules")
    .select("id, slug, title, description, overview, category, estimated_minutes, difficulty, pass_mark, learning_objectives, content, hero_image_path")
    .eq("slug", slug)
    .eq("status", "published")
    .eq("is_published", true)
    .maybeSingle();

  if (error) {
    console.error("Published module lookup failed", { code: error.code, message: error.message });
    throw new Error("The training module could not be loaded. Please try again.");
  }

  return data ? {
    id: data.id,
    slug: data.slug,
    title: data.title,
    description: data.description,
    category: data.category,
    estimatedMinutes: data.estimated_minutes,
    difficulty: data.difficulty,
    passMark: data.pass_mark,
    overview: data.overview,
    learningObjectives: stringArray(data.learning_objectives),
    content: parseAuthoredPublicContent(data.content),
    heroImageUrl: await resolveModuleCoverUrl(supabase, data.hero_image_path),
  } : null;
}

export async function getAdminModuleDraft(moduleId: string): Promise<AdminModuleDraft | null> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("admin_get_module_draft", { module_id: moduleId });
  if (error || !data || typeof data !== "object") return null;
  const payload = data as Record<string, unknown>;
  const definition = moduleAuthoringDefinitionSchema.safeParse(payload.definition);
  if (!definition.success || typeof payload.moduleId !== "string") return null;
  const rawReadiness = payload.readiness && typeof payload.readiness === "object"
    ? payload.readiness as Record<string, unknown>
    : {};
  const rawCounts = rawReadiness.counts && typeof rawReadiness.counts === "object"
    ? rawReadiness.counts as Record<string, unknown>
    : {};
  const localReadiness = getAuthoringReadiness(definition.data);
  let canDelete = payload.canDelete === true;
  if (typeof payload.canDelete !== "boolean") {
    const deletionChecks = await Promise.all([
      supabase.from("module_assignments").select("id", { count: "exact", head: true }).eq("module_id", moduleId),
      supabase.from("module_progress").select("id", { count: "exact", head: true }).eq("module_id", moduleId),
      supabase.from("activity_log").select("id", { count: "exact", head: true }).eq("module_id", moduleId),
      supabase.from("quiz_attempts").select("id", { count: "exact", head: true }).eq("module_id", moduleId),
    ]);
    const checksSucceeded = deletionChecks.every((result) => !result.error);
    const hasRetainedHistory = deletionChecks.some((result) => (result.count ?? 0) > 0);
    const status = typeof payload.status === "string" ? payload.status : "draft";
    const isBuiltIn = ["hazard-perception", "manual-handling", "working-at-height", "cyber-awareness"].includes(definition.data.slug);
    canDelete = checksSucceeded && !isBuiltIn && status === "draft" && payload.isPublished !== true && !hasRetainedHistory;
  }
  const status = typeof payload.status === "string" ? payload.status : "draft";
  return {
    moduleId: payload.moduleId,
    status,
    isPublished: payload.isPublished === true,
    editable: payload.editable === true,
    definition: definition.data,
    coverPreviewUrl: definition.data.heroImagePath.startsWith("/")
      ? definition.data.heroImagePath
      : await resolveModuleCoverUrl(supabase, definition.data.heroImagePath),
    canDelete,
    updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : null,
    readiness: {
      ...localReadiness,
      ready: rawReadiness.ready === true && localReadiness.ready,
      blockers: Array.isArray(rawReadiness.issues)
        ? rawReadiness.issues.filter((item): item is string => typeof item === "string")
        : localReadiness.blockers,
      counts: {
        objectives: Number(rawCounts.objectives ?? localReadiness.counts.objectives),
        learningSections: Number(rawCounts.learningSections ?? localReadiness.counts.learningSections),
        scenarios: Number(rawCounts.scenarios ?? localReadiness.counts.scenarios),
        questions: Number(rawCounts.questions ?? localReadiness.counts.questions),
      },
    },
  };
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { summary: emptySummary, modules: [], latestAttempt: null, recentActivity: [], achievements: [] };

  const [modules, attemptsResult, activityResult, achievementsResult, rankResult] = await Promise.all([
    getTrainingLibrary(userId),
    supabase
      .from("quiz_attempts")
      .select("id, percentage, passed, completed_at, training_modules(slug, title)")
      .eq("user_id", userId)
      .order("completed_at", { ascending: false })
      .limit(1),
    supabase
      .from("activity_log")
      .select("id, event_type, created_at, training_modules(title)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("user_achievements")
      .select("id, earned_at, achievements(title, description)")
      .eq("user_id", userId)
      .order("earned_at", { ascending: false })
      .limit(3),
    supabase.rpc("leaderboard_snapshot"),
  ]);

  const hasAssignments = modules.some((module) => module.isAssigned);
  const pathwayModules = hasAssignments ? modules.filter((module) => module.isAssigned) : modules;
  const assigned = pathwayModules.length;
  const completed = pathwayModules.filter((module) => module.status === "completed").length;
  const points = modules.reduce((total, module) => total + module.pointsEarned, 0);
  const latestRow = attemptsResult.data?.[0];
  const latestModule = moduleJoin(latestRow?.training_modules);
  const rankRows = (rankResult.data ?? []) as LeaderboardRpcRow[];
  const ownRank = rankRows.find((entry) => entry.user_id === userId);

  return {
    summary: {
      overallProgress: overallProgress(completed, assigned),
      completedModules: completed,
      assignedModules: assigned,
      safetyPoints: ownRank ? Number(ownRank.points) : points,
      latestScore: latestRow?.percentage ?? null,
      rank: ownRank ? Number(ownRank.rank) : null,
    },
    modules,
    latestAttempt: latestRow ? {
      id: latestRow.id,
      moduleTitle: latestModule.title ?? "Training module",
      moduleSlug: latestModule.slug ?? "training",
      percentage: latestRow.percentage,
      passed: latestRow.passed,
      completedAt: latestRow.completed_at,
    } : null,
    recentActivity: (activityResult.data ?? []).map((entry) => ({
      id: entry.id,
      eventType: entry.event_type,
      createdAt: entry.created_at,
      moduleTitle: moduleJoin(entry.training_modules).title ?? null,
    })),
    achievements: (achievementsResult.data ?? []).map((entry) => {
      const achievement = achievementJoin(entry.achievements);
      return {
        id: entry.id,
        title: achievement.title ?? "Achievement",
        description: achievement.description ?? "Training milestone completed.",
        earnedAt: entry.earned_at,
      };
    }),
  };
}

export async function getQuizQuestions(moduleId: string): Promise<QuizQuestion[]> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return [];

  const { data } = await supabase.rpc("quiz_questions_for_module", {
    module_id: moduleId,
  });

  const questionRows = (data ?? []) as PublicQuestionRpcRow[];
  return questionRows.map((question) => ({
    id: question.id,
    prompt: question.prompt,
    questionType: question.question_type,
    options: Array.isArray(question.options)
      ? question.options.filter((option: unknown): option is { id: string; label: string } =>
          Boolean(option && typeof option === "object" && "id" in option && "label" in option),
        )
      : [],
    explanation: undefined,
    sortOrder: question.sort_order,
  }));
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return [];
  const { data } = await supabase.rpc("leaderboard_snapshot");
  const rows = (data ?? []) as LeaderboardRpcRow[];
  return rows.map((entry) => ({
    rank: Number(entry.rank),
    userId: entry.user_id,
    displayName: entry.display_name,
    points: Number(entry.points),
    completedModules: Number(entry.completed_modules),
    achievement: entry.achievement ?? null,
  }));
}

export async function getReportsSummary(): Promise<ReportsSummary | null> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("reports_summary");
  if (error || !data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  return {
    scope: row.scope === "department" ? "department" : "organisation",
    department: typeof row.department === "string" ? row.department : null,
    totalTrainees: Number(row.totalTrainees ?? 0),
    totalAssignments: Number(row.totalAssignments ?? 0),
    completedAssignments: Number(row.completedAssignments ?? 0),
    overdueAssignments: Number(row.overdueAssignments ?? 0),
    completionRate: Number(row.completionRate ?? 0),
    averageQuizPercentage: row.averageQuizPercentage === null || row.averageQuizPercentage === undefined
      ? null
      : Number(row.averageQuizPercentage),
    usersRequiringReview: Number(row.usersRequiringReview ?? 0),
    generatedAt: typeof row.generatedAt === "string" ? row.generatedAt : new Date(0).toISOString(),
  };
}

export async function getAchievements(userId: string) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("achievements")
    .select("id, code, title, description, points, user_achievements!left(earned_at, user_id)")
    .order("sort_order");

  return (data ?? []).map((achievement) => {
    const earned = (achievement.user_achievements ?? []).find((record) => record.user_id === userId);
    return { ...achievement, earnedAt: earned?.earned_at ?? null };
  });
}

export async function getAttempt(userId: string, attemptId: string) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const [{ data }, { data: achievementRows }] = await Promise.all([
    supabase.rpc("quiz_attempt_result", { attempt_id: attemptId }),
    supabase
      .from("user_achievements")
      .select("id, earned_at, achievements(title)")
      .eq("user_id", userId)
      .eq("source_attempt_id", attemptId)
      .order("earned_at"),
  ]);
  if (!data) return null;
  const attempt = data as unknown as AttemptResultRpc;
  const { data: moduleSettings } = await supabase
    .from("training_modules")
    .select("pass_mark")
    .eq("id", attempt.module_id)
    .maybeSingle();
  return {
    ...attempt,
    passMark: moduleSettings?.pass_mark ?? null,
    module: {
      slug: attempt.module_slug,
      title: attempt.module_title,
    },
    achievements: (achievementRows ?? []).map((row) => achievementJoin(row.achievements).title ?? "Achievement earned"),
  };
}

export async function getAdminModulesWithReadiness() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return [];
  const overviewResult = await supabase.rpc("admin_list_modules_overview");
  if (!overviewResult.error && Array.isArray(overviewResult.data)) {
    return overviewResult.data.flatMap((value): AdminModuleOverview[] => {
      if (!value || typeof value !== "object") return [];
      const moduleRow = value as Record<string, unknown>;
      const readiness = moduleRow.readiness && typeof moduleRow.readiness === "object"
        ? moduleRow.readiness as Record<string, unknown>
        : {};
      if (typeof moduleRow.id !== "string" || typeof moduleRow.slug !== "string" || typeof moduleRow.title !== "string") return [];
      return [{
        id: moduleRow.id,
        title: moduleRow.title,
        description: typeof moduleRow.description === "string" ? moduleRow.description : "",
        slug: moduleRow.slug,
        estimated_minutes: Number(moduleRow.estimated_minutes ?? 0),
        difficulty: typeof moduleRow.difficulty === "string" ? moduleRow.difficulty : "introductory",
        status: typeof moduleRow.status === "string" ? moduleRow.status : "draft",
        is_published: moduleRow.is_published === true,
        sort_order: Number(moduleRow.sort_order ?? 0),
        is_authored: moduleRow.is_authored === true,
        can_delete: moduleRow.can_delete === true,
        updated_at: typeof moduleRow.updated_at === "string" ? moduleRow.updated_at : null,
        readiness: {
          ready: readiness.ready === true,
          issues: Array.isArray(readiness.issues)
            ? readiness.issues.filter((item): item is string => typeof item === "string")
            : [],
        },
      }];
    });
  }

  // Compatibility fallback for an environment where the latest migration has
  // not reached the database yet. Eligibility fails closed on every query error.
  const { data: modules, error: modulesError } = await supabase
    .from("training_modules")
    .select("id, slug, title, description, estimated_minutes, difficulty, status, is_published, sort_order")
    .order("sort_order");
  if (modulesError) return [];
  return Promise.all((modules ?? []).map(async (module): Promise<AdminModuleOverview> => {
    const [readinessResult, ...deletionChecks] = await Promise.all([
      supabase.rpc("admin_module_readiness", { module_id: module.id }),
      supabase.from("module_assignments").select("id", { count: "exact", head: true }).eq("module_id", module.id),
      supabase.from("module_progress").select("id", { count: "exact", head: true }).eq("module_id", module.id),
      supabase.from("activity_log").select("id", { count: "exact", head: true }).eq("module_id", module.id),
      supabase.from("quiz_attempts").select("id", { count: "exact", head: true }).eq("module_id", module.id),
    ]);
    const readiness = readinessResult.data && typeof readinessResult.data === "object"
      ? readinessResult.data as Record<string, unknown>
      : {};
    const isAuthored = !["hazard-perception", "manual-handling", "working-at-height", "cyber-awareness"].includes(module.slug);
    const checksSucceeded = deletionChecks.every((result) => !result.error);
    const hasRetainedHistory = deletionChecks.some((result) => (result.count ?? 0) > 0);
    return {
      ...module,
      is_authored: isAuthored,
      can_delete: checksSucceeded && isAuthored && module.status === "draft" && !module.is_published && !hasRetainedHistory,
      updated_at: null,
      readiness: {
        ready: !readinessResult.error && readiness.ready === true,
        issues: Array.isArray(readiness.issues)
          ? readiness.issues.filter((item): item is string => typeof item === "string")
          : [],
      },
    };
  }));
}

export async function getNextAdminModuleOrder() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return 10;
  const { data } = await supabase
    .from("training_modules")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  return Math.max(0, data?.sort_order ?? 0) + 10;
}

export async function getAdminData() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { profiles: [], modules: [], assignments: [], attempts: [], progress: [], activity: [] };
  const [profiles, modules, assignments, attempts, progress, activity] = await Promise.all([
    supabase.from("profiles").select("id, full_name, employee_number, department, role, status, updated_at").order("full_name"),
    supabase.from("training_modules").select("id, slug, title, description, estimated_minutes, difficulty, status, is_published, sort_order").order("sort_order"),
    supabase.from("module_assignments").select("id, user_id, module_id, due_date, status, assigned_at").order("assigned_at", { ascending: false }),
    supabase.from("quiz_attempts").select("id, user_id, module_id, percentage, passed, completed_at").order("completed_at", { ascending: false }).limit(100),
    supabase.from("module_progress").select("id, user_id, module_id, progress_percent, status, points_earned, last_activity_at"),
    supabase.from("activity_log").select("id, user_id, module_id, event_type, created_at").order("created_at", { ascending: false }).limit(12),
  ]);
  return {
    profiles: profiles.data ?? [], modules: modules.data ?? [], assignments: assignments.data ?? [],
    attempts: attempts.data ?? [], progress: progress.data ?? [], activity: activity.data ?? [],
  };
}
