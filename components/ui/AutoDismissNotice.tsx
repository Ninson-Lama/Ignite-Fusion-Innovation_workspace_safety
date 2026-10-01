"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { NOTIFICATION_DISMISS_MS } from "@/lib/notifications";

interface AutoDismissNoticeProps {
  children: ReactNode;
  className: string;
  onDismiss: () => void;
  role?: "alert" | "status";
}

export function AutoDismissNotice({ children, className, onDismiss, role = "status" }: AutoDismissNoticeProps) {
  const dismissRef = useRef(onDismiss);

  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const timer = window.setTimeout(() => dismissRef.current(), NOTIFICATION_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className={`${className} auto-dismiss-notice`} role={role} aria-atomic="true">
      {children}
    </div>
  );
}
