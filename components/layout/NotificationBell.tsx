"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Bell, BellRing, CheckCheck, Clock3 } from "lucide-react";
import type { AssignmentNotification } from "@/lib/queries";

function notificationTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kathmandu",
  }).format(new Date(value));
}

function dueDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export function NotificationBell({
  initialNotifications,
  compact = false,
}: {
  initialNotifications: AssignmentNotification[];
  compact?: boolean;
}) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [open, setOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const headingId = useId();
  const unread = notifications.filter((notification) => !notification.readAt);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/notifications", { cache: "no-store" });
    if (!response.ok) return;
    const body = await response.json() as { notifications?: AssignmentNotification[] };
    if (Array.isArray(body.notifications)) setNotifications(body.notifications);
  }, []);

  const markRead = useCallback((ids: string[]) => {
    if (!ids.length) return;
    const readAt = new Date().toISOString();
    setNotifications((current) => current.map((notification) => (
      ids.includes(notification.id) ? { ...notification, readAt } : notification
    )));
    void fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
      keepalive: true,
    }).then((response) => {
      if (!response.ok) void refresh();
    }).catch(() => void refresh());
  }, [refresh]);

  useEffect(() => {
    const poll = window.setInterval(() => void refresh(), 45_000);
    const handleFocus = () => void refresh();
    const handleVisibility = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!shellRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className={`notification-shell${compact ? " notification-shell-compact" : ""}`} ref={shellRef}>
      <button
        className="notification-trigger"
        type="button"
        ref={buttonRef}
        aria-label={unread.length ? `${unread.length} unread training notification${unread.length === 1 ? "" : "s"}` : "Training notifications"}
        aria-haspopup="dialog"
        aria-controls={panelId}
        aria-expanded={open}
        onClick={() => setOpen((current) => {
          if (!current) void refresh();
          return !current;
        })}
      >
        {unread.length ? <BellRing size={19} /> : <Bell size={19} />}
        {unread.length > 0 && <span className="notification-count">{Math.min(unread.length, 9)}</span>}
      </button>

      {open && (
        <section className="notification-panel" id={panelId} role="dialog" aria-modal="false" aria-labelledby={headingId}>
          <header>
            <div><span>Training updates</span><h2 id={headingId}>Notifications</h2></div>
            {unread.length > 0 && <button type="button" onClick={() => markRead(unread.map((item) => item.id))}><CheckCheck size={16} /> Mark all read</button>}
          </header>
          {notifications.length ? (
            <ol>
              {notifications.map((notification) => (
                <li className={notification.readAt ? "" : "unread"} key={notification.id}>
                  <Link href={`/training/${notification.moduleSlug}`} onClick={() => {
                    if (!notification.readAt) markRead([notification.id]);
                    setOpen(false);
                  }}>
                    <span className="notification-icon"><Bell size={16} /></span>
                    <div>
                      <strong>New module assigned</strong>
                      <p>Your administrator assigned <b>{notification.moduleTitle}</b>.</p>
                      <small><Clock3 size={13} /> {notificationTime(notification.sentAt)}{notification.dueDate ? ` · Due ${dueDate(notification.dueDate)}` : ""}</small>
                    </div>
                    {!notification.readAt && <i aria-label="Unread" />}
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <div className="notification-empty"><CheckCheck size={22} /><strong>You’re up to date</strong><p>New module assignments will appear here.</p></div>
          )}
          <footer><Link href="/training" onClick={() => setOpen(false)}>Open training library</Link></footer>
        </section>
      )}
    </div>
  );
}
