import Link from "next/link";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: { href: string; label: string };
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <span className="empty-icon" aria-hidden="true"><Inbox size={22} /></span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action && <Link className="button button-secondary button-small" href={action.href}>{action.label}</Link>}
    </div>
  );
}
