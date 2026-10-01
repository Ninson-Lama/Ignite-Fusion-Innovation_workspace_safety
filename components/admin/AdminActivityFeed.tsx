"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Radio, RefreshCw } from "lucide-react";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import type { AdminActivityEvent } from "@/lib/admin-activity";

export function AdminActivityFeed() {
  const router = useRouter();
  const [events, setEvents] = useState<AdminActivityEvent[]>([]);
  const [mode, setMode] = useState("Connecting");
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  useEffect(() => {
    const controller = new AbortController();
    let fetching = false, queued = false, subscribed = false, ready = false;
    let signature: string | null = null;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    async function refresh() {
      if (controller.signal.aborted || document.hidden) return;
      if (fetching) { queued = true; return; }
      fetching = true;
      try {
        const response = await fetch("/api/admin/activity", { cache: "no-store", signal: controller.signal });
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) setEvents([]);
          throw new Error(response.status === 401 || response.status === 403 ? "Your administrator session needs to be renewed." : "Connection interrupted. Updates will retry automatically.");
        }
        const body = await response.json() as { events: AdminActivityEvent[]; realtimeReady: boolean };
        if (controller.signal.aborted) return;
        if (!Array.isArray(body.events)) throw new Error("The activity feed could not be read.");
        const nextSignature = body.events.map((event) => event.id).join(",");
        if (signature !== null && nextSignature !== signature) router.refresh();
        signature = nextSignature;
        ready = body.realtimeReady;
        setEvents(body.events); setError(null); setUpdated(new Date().toISOString());
        setMode(!ready ? "Setup required · auto-refresh" : subscribed ? "Live" : "Reconnecting · auto-refresh");
      } catch (failure) {
        ready = false;
        if (!controller.signal.aborted) { setError(failure instanceof Error ? failure.message : "Updates unavailable"); setMode("Reconnecting"); }
      } finally {
        fetching = false;
        if (queued && !controller.signal.aborted) { queued = false; void refresh(); }
      }
    }
    const schedule = () => { clearTimeout(debounce); debounce = setTimeout(() => void refresh(), 200); };
    const supabase = getBrowserSupabaseClient();
    const channel = supabase?.channel("admin-management-events")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "admin_activity_events" }, schedule)
      .subscribe((status: string) => {
        subscribed = status === "SUBSCRIBED";
        if (!controller.signal.aborted) { setMode(ready && subscribed ? "Live" : "Connecting · auto-refresh"); schedule(); }
      });
    void refresh();
    const poll = setInterval(() => void refresh(), 10000);
    window.addEventListener("online", schedule); window.addEventListener("focus", schedule);
    document.addEventListener("visibilitychange", schedule);
    return () => {
      controller.abort(); clearTimeout(debounce); clearInterval(poll);
      window.removeEventListener("online", schedule); window.removeEventListener("focus", schedule);
      document.removeEventListener("visibilitychange", schedule);
      if (channel) void supabase?.removeChannel(channel);
    };
  }, [router]);
  const shown = events.filter((event) => filter === "all" || event.category === filter);
  return <section className="admin-activity-card live-activity-feed">
    <div className="section-heading"><div><p className="section-kicker">Management activity</p><h2>Live activity log</h2></div><span className={`feed-connection ${mode === "Live" ? "connected" : ""}`}><Radio size={15} />{mode}</span></div>
    <div className="feed-toolbar"><label>Show<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All events</option><option value="training">Training & progress</option><option value="games">Mini-games</option><option value="system">System & assignments</option></select></label><small>{updated ? `Updated ${new Date(updated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "Loading saved events…"}</small></div>
    {error && <p className="form-status error" role="alert"><RefreshCw size={16} />{error}</p>}
    <div className="feed-events" aria-live="polite" aria-relevant="additions text">{shown.length ? <ol>{shown.map((event) => <li key={event.id}><span className={`feed-event-icon ${event.category}`}><Activity size={16} /></span><div><strong>{event.subject} · {event.eventType.replaceAll("_", " ")}</strong>{event.moduleTitle && <p>{event.moduleTitle}</p>}<p>{event.detail}</p><time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time></div></li>)}</ol> : <p className="feed-empty">{updated ? "No saved events in this category yet." : "Connecting to your management activity…"}</p>}</div>
  </section>;
}
