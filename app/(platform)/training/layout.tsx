import { requireTrainee } from "@/lib/auth";

export default async function TrainingLayout({ children }: { children: React.ReactNode }) {
  await requireTrainee();
  return children;
}
