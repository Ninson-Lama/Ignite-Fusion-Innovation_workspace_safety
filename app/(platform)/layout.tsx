import { AppShell } from "@/components/layout/AppShell";
import { requireViewer } from "@/lib/auth";
import { getAssignmentNotifications } from "@/lib/queries";
import "./workspace.css";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  const notifications = viewer.role === "trainee"
    ? await getAssignmentNotifications(viewer.id)
    : [];
  return <AppShell viewer={viewer} notifications={notifications}>{children}</AppShell>;
}
