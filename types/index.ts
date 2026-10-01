export type UserRole = "trainee" | "admin";
export type ProfileStatus = "active" | "inactive" | "suspended";
export type ModuleStatus = "not_started" | "in_progress" | "completed";
export type Difficulty = "Foundation" | "Intermediate" | "Advanced";

export interface ViewerProfile {
  id: string;
  fullName: string;
  email: string;
  employeeNumber: string | null;
  department: string | null;
  role: UserRole;
  status: ProfileStatus;
}

export interface LearningSection {
  title: string;
  summary: string;
  points: string[];
}

export interface ActivityChoice {
  id: string;
  label: string;
  isSafe: boolean;
  feedback: string;
}

export interface ActivityScenario {
  id: string;
  number: string;
  situation: string;
  prompt: string;
  choices: ActivityChoice[];
}

export interface PublicActivityChoice {
  id: string;
  label: string;
}

export interface PublicActivityScenario {
  id: string;
  number: string;
  situation: string;
  prompt: string;
  choices: PublicActivityChoice[];
}

export interface TrainingModule {
  slug: "hazard-perception" | "manual-handling" | "working-at-height" | "cyber-awareness";
  title: string;
  shortTitle: string;
  description: string;
  category: string;
  estimatedMinutes: number;
  difficulty: Difficulty;
  label: string;
  visualClass: string;
  objectives: string[];
  learning: LearningSection[];
  activities: ActivityScenario[];
}

export interface HazardDefinition {
  id: string;
  code: string;
  title: string;
  risk: string;
  consequence: string;
  correctiveAction: string;
  position: string;
  colour: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  questionType: "single_choice" | "multiple_choice" | "true_false";
  options: Array<{ id: string; label: string }>;
  explanation?: string;
  sortOrder: number;
}

export interface ModuleProgressView {
  moduleSlug: string;
  progressPercent: number;
  status: ModuleStatus;
  pointsEarned: number;
  activityComplete: boolean;
  latestScore: number | null;
}

export interface DashboardSummary {
  overallProgress: number;
  completedModules: number;
  assignedModules: number;
  safetyPoints: number;
  latestScore: number | null;
  rank: number | null;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  points: number;
  completedModules: number;
  achievement: string | null;
}

export interface TrainingCertificateRecord {
  moduleId: string;
  moduleSlug: string;
  moduleTitle: string;
  category: string;
  completedAt: string;
  attemptId: string;
  certificateReference: string;
}
