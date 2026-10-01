interface StatusBadgeProps { status: string; }

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalised = status.toLowerCase().replaceAll("_", " ");
  const tone = ["complete", "completed", "passed", "active", "published"].includes(normalised)
    ? "success"
    : ["overdue", "failed", "inactive", "unpublished"].includes(normalised)
      ? "danger"
      : ["in progress", "review"].includes(normalised)
        ? "warning"
        : "neutral";
  return <span className={`status-badge status-${tone}`}>{normalised}</span>;
}
